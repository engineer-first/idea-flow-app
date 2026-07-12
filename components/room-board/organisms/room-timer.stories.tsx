import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import { RoomTimer } from "./room-timer";

const meta = {
  title: "RoomBoard/Organisms/RoomTimer",
  component: RoomTimer,
  args: {
    timer: { status: "idle" },
    serverOffsetMs: 0,
    isHost: true,
    disabled: false,
    onStart: fn(),
    onPause: fn(),
    onResume: fn(),
    onExtend: fn(),
    onStop: fn(),
  },
} satisfies Meta<typeof RoomTimer>;

export default meta;
type Story = StoryObj<typeof meta>;

export const IdleHost: Story = {};
export const IdleMember: Story = { args: { isHost: false } };
export const RunningHost: Story = {
  args: {
    timer: {
      status: "running",
      endsAt: Date.now() + 5 * 60_000,
      durationMs: 5 * 60_000,
    },
  },
};
export const RunningMember: Story = {
  args: { ...RunningHost.args, isHost: false },
};
export const PausedHost: Story = {
  args: {
    timer: {
      status: "paused",
      remainingMs: 2 * 60_000 + 30_000,
      durationMs: 5 * 60_000,
    },
  },
};
export const PausedMember: Story = {
  args: { ...PausedHost.args, isHost: false },
};
export const EndedHost: Story = {
  args: {
    timer: { status: "running", endsAt: Date.now() - 1, durationMs: 60_000 },
  },
};
export const EndedMember: Story = {
  args: { ...EndedHost.args, isHost: false },
};
