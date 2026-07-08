// api-worker: D1（ロビー）と RoomDO（ルームの中身）への唯一の入口。
// すべてのエンドポイントはセッション（または署名済みログイン主張）を要求する。
// Next 側は UI とセッション Cookie の発行だけを担い、データへは必ずここを通る。
import { z } from "zod";
import { isUuid } from "../contracts/ids";
import {
  isValidInviteCode,
  normalizeInviteCode,
} from "../contracts/invite-code";
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
import { HOST_ID_HEADER, RoomDO, USER_ID_HEADER } from "./room-do";

export { RoomDO };

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
  const stub = roomStub(env, room.roomId);
  await stub.upsertMember(session.sub, session.name);
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

  const stub = roomStub(env, room.roomId);
  await stub.upsertMember(session.sub, session.name);
  return json({ roomId: room.roomId });
}

// GET /api/rooms/:id — メンバーだけがルーム情報を取得できる。
// 非メンバーには存在しないルームと同じ 404 を返し、存在を推測させない。
// isHost / phase はこのエンドポイントでのみ返す（#70 で他人の host_id が
// 漏れる経路を増やさないため、isHost フラグでだけ返す）。
async function handleGetRoom(
  env: Env,
  session: SessionPayload,
  roomId: string,
): Promise<Response> {
  const room = await findRoomById(env.DB, roomId);
  if (!room) {
    return error(404, "ルームが見つかりませんでした。");
  }

  const stub = roomStub(env, roomId);
  const member = await stub.isMember(session.sub);
  if (!member) {
    return error(404, "ルームが見つかりませんでした。");
  }

  const phase = await stub.getPhase();
  return json({
    roomId: room.roomId,
    inviteCode: room.inviteCode,
    isHost: room.hostId === session.sub,
    phase,
  });
}

// GET /api/rooms/:id/members — メンバーだけが参加メンバー一覧を取得できる。
// 初期表示（SSR）のために name 付きで返す。Realtime 反映は WS の
// member_joined / snapshot.members で行う。
async function handleListMembers(
  env: Env,
  session: SessionPayload,
  roomId: string,
): Promise<Response> {
  const room = await findRoomById(env.DB, roomId);
  if (!room) {
    return error(404, "ルームが見つかりませんでした。");
  }

  const stub = roomStub(env, roomId);
  const member = await stub.isMember(session.sub);
  if (!member) {
    return error(404, "ルームが見つかりませんでした。");
  }

  const members = await stub.listMembers();
  return json({ members });
}

// GET /api/rooms/:id/ws — メンバーのみ WebSocket 接続できる。
// 認可はここで完結させ、DO へは検証済みユーザーIDと hostId をヘッダーで
// 引き継ぐ。hostId は start_phase の認可で RoomDO が再判定に使う。
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
  headers.set(HOST_ID_HEADER, room.hostId);
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
      if (!isUuid(wsMatch[1])) {
        return error(404, "ルームが見つかりませんでした。");
      }
      return handleRoomWebSocket(request, env, session, wsMatch[1]);
    }

    // /members は /ws より先に評価する必要はない（path が違う）が、
    // /rooms/:id 直下の GET と区別するためパスを明示する。
    const membersMatch = pathname.match(/^\/api\/rooms\/([^/]+)\/members$/);
    if (method === "GET" && membersMatch?.[1]) {
      if (!isUuid(membersMatch[1])) {
        return error(404, "ルームが見つかりませんでした。");
      }
      return handleListMembers(env, session, membersMatch[1]);
    }

    const roomMatch = pathname.match(/^\/api\/rooms\/([^/]+)$/);
    if (method === "GET" && roomMatch?.[1]) {
      if (!isUuid(roomMatch[1])) {
        return error(404, "ルームが見つかりませんでした。");
      }
      return handleGetRoom(env, session, roomMatch[1]);
    }

    return error(404, "not found");
  },
} satisfies ExportedHandler<Env>;
