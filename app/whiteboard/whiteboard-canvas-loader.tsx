"use client";

import dynamic from "next/dynamic";

export default dynamic(() => import("@/app/whiteboard/whiteboard-canvas"), {
  ssr: false,
  loading: () => <p>読み込み中...</p>,
});
