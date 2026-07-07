// api-worker: D1（ロビー）と RoomDO（ルームの中身）への唯一の入口。
// すべてのエンドポイントはセッション（または署名済みログイン主張）を要求する。
// Next 側は UI とセッション Cookie の発行だけを担い、データへは必ずここを通る。
import { z } from "zod";
import {
  isValidInviteCode,
  normalizeInviteCode,
} from "../app/rooms/invite-code";
import {
  LoginAssertionSchema,
  type SessionPayload,
  TOKEN_AUDIENCE,
} from "../contracts/session";
import { verifyToken } from "../lib/session/token";
import {
  ensureUser,
  findRoomByCode,
  findRoomById,
  insertRoom,
  upsertUserFromAssertion,
} from "./lib/db";
import { getSessionFromRequest } from "./lib/session";
import { requireSessionSecret } from "./lib/session-secret";
import {
  INVITE_CODE_HEADER,
  ROOM_ID_HEADER,
  RoomDO,
  USER_ID_HEADER,
} from "./room-do";

export { RoomDO };

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const SyncRequestSchema = z.object({ assertion: z.string().min(1) });
const JoinRequestSchema = z.object({ code: z.string() });

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function error(status: number, message: string): Response {
  return json({ error: message }, status);
}

function roomStub(env: Env, roomId: string): DurableObjectStub<RoomDO> {
  return env.ROOM_DO.get(env.ROOM_DO.idFromName(roomId));
}

async function readJsonBody(request: Request): Promise<unknown | null> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

// POST /api/auth/sync — ログイン確定時のユーザー upsert。
// セッションではなく「署名済みログイン主張」で認証する（ログイン前なので）。
async function handleAuthSync(request: Request, env: Env): Promise<Response> {
  const body = SyncRequestSchema.safeParse(await readJsonBody(request));
  if (!body.success) {
    return error(400, "リクエスト形式が不正です。");
  }

  const assertion = await verifyToken(
    body.data.assertion,
    LoginAssertionSchema,
    { secret: env.SESSION_SECRET, audience: TOKEN_AUDIENCE.loginAssertion },
  );
  if (!assertion) {
    return error(401, "ログイン主張を検証できませんでした。");
  }

  const userId = await upsertUserFromAssertion(env.DB, assertion);
  return json({ userId });
}

// POST /api/rooms — ルーム作成。D1 に行を作り、RoomDO に host を登録する。
async function handleCreateRoom(
  env: Env,
  session: SessionPayload,
): Promise<Response> {
  await ensureUser(env.DB, {
    id: session.sub,
    email: session.email,
    name: session.name,
  });
  const room = await insertRoom(env.DB, session.sub);
  await roomStub(env, room.roomId).join(session.sub);
  return json({ roomId: room.roomId, inviteCode: room.inviteCode });
}

// POST /api/rooms/join — 招待コードで参加（冪等）。
async function handleJoinRoom(
  request: Request,
  env: Env,
  session: SessionPayload,
): Promise<Response> {
  const body = JoinRequestSchema.safeParse(await readJsonBody(request));
  if (!body.success) {
    return error(400, "リクエスト形式が不正です。");
  }

  const code = normalizeInviteCode(body.data.code);
  if (!isValidInviteCode(code)) {
    return error(400, "招待コードは英数字6桁で入力してください。");
  }

  const room = await findRoomByCode(env.DB, code);
  if (!room) {
    return error(404, "ルームが見つかりませんでした。");
  }

  await roomStub(env, room.roomId).join(session.sub);
  return json({ roomId: room.roomId });
}

// GET /api/rooms/:id — メンバーだけがルーム情報を取得できる。
// 非メンバーには存在しないルームと同じ 404 を返し、存在を推測させない。
async function handleGetRoom(
  env: Env,
  session: SessionPayload,
  roomId: string,
): Promise<Response> {
  const room = await findRoomById(env.DB, roomId);
  if (!room) {
    return error(404, "ルームが見つかりませんでした。");
  }

  const member = await roomStub(env, roomId).isMember(session.sub);
  if (!member) {
    return error(404, "ルームが見つかりませんでした。");
  }

  return json({ roomId: room.roomId, inviteCode: room.inviteCode });
}

// GET /api/rooms/:id/ws — メンバーのみ WebSocket 接続できる。
// 認可はここで完結させ、DO へは検証済みユーザーIDをヘッダーで引き継ぐ。
async function handleRoomWebSocket(
  request: Request,
  env: Env,
  session: SessionPayload,
  roomId: string,
): Promise<Response> {
  if (request.headers.get("Upgrade") !== "websocket") {
    return error(426, "WebSocket でアクセスしてください。");
  }

  const room = await findRoomById(env.DB, roomId);
  if (!room) {
    return error(404, "ルームが見つかりませんでした。");
  }

  const stub = roomStub(env, roomId);
  const member = await stub.isMember(session.sub);
  if (!member) {
    return error(404, "ルームが見つかりませんでした。");
  }

  const headers = new Headers(request.headers);
  headers.set(USER_ID_HEADER, session.sub);
  // snapshot 用のルーム情報（D1 が真実）を DO へ引き継ぐ。
  headers.set(ROOM_ID_HEADER, room.roomId);
  headers.set(INVITE_CODE_HEADER, room.inviteCode);
  return stub.fetch(request.url, { headers });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // 設定漏れ（本番で secret 未設定）を既知鍵での fail-open にせず、
    // 明示的に落とす。認証を扱う前に必ず検証する。
    try {
      requireSessionSecret(env.SESSION_SECRET);
    } catch {
      return error(503, "サーバーの認証設定が未完了です。");
    }

    const url = new URL(request.url);
    const { pathname } = url;
    const method = request.method;

    if (method === "POST" && pathname === "/api/auth/sync") {
      return handleAuthSync(request, env);
    }

    // 以降はすべてセッション必須。
    const session = await getSessionFromRequest(request, env.SESSION_SECRET);
    if (!session) {
      return error(401, "ログインが必要です。");
    }

    if (method === "POST" && pathname === "/api/rooms") {
      return handleCreateRoom(env, session);
    }

    if (method === "POST" && pathname === "/api/rooms/join") {
      return handleJoinRoom(request, env, session);
    }

    const wsMatch = pathname.match(/^\/api\/rooms\/([^/]+)\/ws$/);
    if (method === "GET" && wsMatch?.[1]) {
      if (!UUID_PATTERN.test(wsMatch[1])) {
        return error(404, "ルームが見つかりませんでした。");
      }
      return handleRoomWebSocket(request, env, session, wsMatch[1]);
    }

    const roomMatch = pathname.match(/^\/api\/rooms\/([^/]+)$/);
    if (method === "GET" && roomMatch?.[1]) {
      if (!UUID_PATTERN.test(roomMatch[1])) {
        return error(404, "ルームが見つかりませんでした。");
      }
      return handleGetRoom(env, session, roomMatch[1]);
    }

    return error(404, "not found");
  },
} satisfies ExportedHandler<Env>;
