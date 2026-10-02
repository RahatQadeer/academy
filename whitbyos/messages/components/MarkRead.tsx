"use client";

import { useEffect } from "react";
import { markThreadRead } from "@/whitbyos/messages/actions";

/**
 * Opening a thread is reading it.
 *
 * There is no "mark as unread" to go with this, and that is the design: bold
 * means unread, and it stops being bold once you have looked at it. Nothing in
 * the export offers a way back, and inventing one would put a second, manual
 * meaning on top of a mark that already means something.
 */
export function MarkRead({ threadId, also }: { threadId: string; also?: string[] }) {
  /* What was read, as one value: an array is a new object on every render,
     and the effect is about which threads those are. */
  const ids = [...new Set([threadId, ...(also ?? [])])].join(",");

  useEffect(() => {
    const form = new FormData();
    form.set("thread_id", ids.split(",")[0]);
    form.set("thread_ids", ids);
    void markThreadRead(form);
  }, [ids]);

  return null;
}
