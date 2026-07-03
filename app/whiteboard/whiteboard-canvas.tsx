"use client";

import { useEffect, useState } from "react";
import {
  createTLStore,
  defaultShapeUtils,
  type TLRecord,
  Tldraw,
} from "tldraw";
import "tldraw/tldraw.css";
import { createClient } from "@/lib/supabase/client";

const CHANNEL_NAME = "whiteboard-poc";
const EVENT_NAME = "store-update";

type StoreUpdatePayload = {
  added: TLRecord[];
  updated: TLRecord[];
  removed: string[];
};

export default function WhiteboardCanvas() {
  const [store] = useState(() =>
    createTLStore({ shapeUtils: defaultShapeUtils }),
  );
  const [supabase] = useState(() => createClient());

  useEffect(() => {
    const channel = supabase.channel(CHANNEL_NAME);

    channel.on(
      "broadcast",
      { event: EVENT_NAME },
      ({ payload }: { payload: StoreUpdatePayload }) => {
        store.mergeRemoteChanges(() => {
          if (payload.added.length > 0) {
            store.put(payload.added);
          }
          if (payload.updated.length > 0) {
            store.put(payload.updated);
          }
          if (payload.removed.length > 0) {
            store.remove(payload.removed as TLRecord["id"][]);
          }
        });
      },
    );

    channel.subscribe();

    const unlisten = store.listen(
      (entry) => {
        const added = Object.values(entry.changes.added);
        const updated = Object.values(entry.changes.updated).map(
          ([, next]) => next,
        );
        const removed = Object.keys(entry.changes.removed);

        if (
          added.length === 0 &&
          updated.length === 0 &&
          removed.length === 0
        ) {
          return;
        }

        const payload: StoreUpdatePayload = { added, updated, removed };

        channel.send({
          type: "broadcast",
          event: EVENT_NAME,
          payload,
        });
      },
      { source: "user", scope: "document" },
    );

    return () => {
      unlisten();
      supabase.removeChannel(channel);
    };
  }, [store, supabase]);

  return (
    <div style={{ position: "fixed", inset: 0 }}>
      <Tldraw store={store} />
    </div>
  );
}
