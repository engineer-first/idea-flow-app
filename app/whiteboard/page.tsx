import type { Metadata } from "next";
import WhiteboardCanvasLoader from "@/app/whiteboard/whiteboard-canvas-loader";

export const metadata: Metadata = {
  title: "Whiteboard",
  description: "tldraw × Supabase Realtime Broadcast 同期PoC",
};

export default function WhiteboardPage() {
  return <WhiteboardCanvasLoader />;
}
