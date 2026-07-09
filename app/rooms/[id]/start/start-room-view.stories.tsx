import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import { ROOM_MEMBERS_MAX_VISIBLE } from "@/app/rooms/[id]/room-members";
import { buildMembers } from "@/app/rooms/[id]/room-members.fixture";
import {
  StartRoomView,
  type StartRoomViewProps,
} from "@/app/rooms/[id]/start/start-room-view";

const ME = "11111111-1111-4111-8111-111111111111";

const baseArgs: StartRoomViewProps = {
  members: buildMembers(3, ME),
  currentUserId: ME,
  isHost: true,
  hostUserId: ME,
  phase: "lobby",
  inviteCode: "AB12CD",
  inviteUrl: "https://idea-flow.example/invite/AB12CD",
  connectionStatus: "open",
  isStarting: false,
  onStart: fn(),
  onLeave: fn(),
  isLeaving: false,
};

const meta = {
  title: "Rooms/Lobby/StartRoomView",
  component: StartRoomView,
  parameters: { layout: "fullscreen" },
  args: baseArgs,
  decorators: [
    (Story) => (
      <div style={{ height: "100vh" }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof StartRoomView>;

export default meta;
type Story = StoryObj<typeof meta>;

// ---------------------------------------------------------------------------
// 参加人数（ホスト視点）
// ---------------------------------------------------------------------------

/** 自分だけ参加 */
export const Solo: Story = {
  name: "参加 1 人（自分のみ）",
  args: { members: buildMembers(1, ME) },
};

/** 少人数 */
export const FewMembers: Story = {
  name: "参加 3 人",
  args: { members: buildMembers(3, ME) },
};

/** 2 列が効く人数 */
export const SixMembers: Story = {
  name: "参加 6 人",
  args: { members: buildMembers(6, ME) },
};

/** 表示上限ちょうど 4×3（+N なし） */
export const TwelveMembers: Story = {
  name: "参加 12 人（4×3 上限ちょうど）",
  args: { members: buildMembers(ROOM_MEMBERS_MAX_VISIBLE, ME) },
};

/** 13 人 → 最終マスが +N */
export const ThirteenMembers: Story = {
  name: "参加 13 人（+N）",
  args: { members: buildMembers(ROOM_MEMBERS_MAX_VISIBLE + 1, ME) },
};

/** 多人数 */
export const FifteenMembers: Story = {
  name: "参加 15 人（+N）",
  args: { members: buildMembers(15, ME) },
};

// ---------------------------------------------------------------------------
// 役割・接続
// ---------------------------------------------------------------------------

/** ホスト（既定・招待カードあり） */
export const Host: Story = {
  name: "ホスト",
  args: { isHost: true },
};

/** ゲスト（招待カードなし・開始待機） */
export const Guest: Story = {
  name: "ゲスト（待機中）",
  args: {
    isHost: false,
    members: buildMembers(4, ME),
  },
};

/** ゲスト + 12 人超 */
export const GuestWithOverflow: Story = {
  name: "ゲスト・参加 15 人",
  args: {
    isHost: false,
    members: buildMembers(15, ME),
  },
};

export const Starting: Story = {
  name: "開始処理中",
  args: { isStarting: true },
};

export const Connecting: Story = {
  name: "接続中",
  args: { connectionStatus: "connecting" },
};

export const Reconnecting: Story = {
  name: "再接続中",
  args: { connectionStatus: "closed" },
};

export const Leaving: Story = {
  name: "解散処理中",
  args: { isLeaving: true },
};

// ---------------------------------------------------------------------------
// カタログ
// ---------------------------------------------------------------------------

/** 参加状態を一覧で比較（人数バリエーション中心） */
export const AllParticipationStates: Story = {
  name: "一覧: 参加人数",
  render: () => {
    const states: { label: string; count: number; isHost?: boolean }[] = [
      { label: "1 人（自分のみ）", count: 1 },
      { label: "3 人", count: 3 },
      { label: "4 人（1 行）", count: 4 },
      { label: "8 人", count: 8 },
      { label: "12 人（4×3 上限）", count: ROOM_MEMBERS_MAX_VISIBLE },
      { label: "13 人（+N）", count: ROOM_MEMBERS_MAX_VISIBLE + 1 },
      { label: "15 人（+N）", count: 15 },
      { label: "ゲスト・15 人", count: 15, isHost: false },
    ];
    return (
      <div className="flex flex-col gap-10 p-4">
        {states.map(({ label, count, isHost = true }) => (
          <div key={label} className="flex flex-col gap-2">
            <span className="font-mono text-xs text-muted-foreground">
              {label}
            </span>
            <div className="min-h-[640px] overflow-hidden rounded-xl border border-border">
              <StartRoomView
                {...baseArgs}
                members={buildMembers(count, ME)}
                isHost={isHost}
              />
            </div>
          </div>
        ))}
      </div>
    );
  },
};

/** 役割・接続まわりの一覧 */
export const AllInteractionStates: Story = {
  name: "一覧: 役割・接続",
  render: () => {
    const states: { label: string; props: Partial<StartRoomViewProps> }[] = [
      { label: "Host", props: { isHost: true } },
      { label: "Guest", props: { isHost: false } },
      { label: "Starting", props: { isStarting: true } },
      { label: "Connecting", props: { connectionStatus: "connecting" } },
      { label: "Reconnecting", props: { connectionStatus: "closed" } },
      { label: "Leaving", props: { isLeaving: true } },
    ];
    return (
      <div className="flex flex-col gap-10 p-4">
        {states.map(({ label, props }) => (
          <div key={label} className="flex flex-col gap-2">
            <span className="font-mono text-xs text-muted-foreground">
              {label}
            </span>
            <div className="min-h-[640px] overflow-hidden rounded-xl border border-border">
              <StartRoomView {...baseArgs} {...props} />
            </div>
          </div>
        ))}
      </div>
    );
  },
};
