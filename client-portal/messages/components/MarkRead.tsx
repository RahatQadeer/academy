"use client";

import { useEffect } from "react";
import { markThreadRead } from "@/client-portal/lib/actions/messages";

/**
 * Marks the open thread read. Rendered rather than called during the page's own
 * render: marking read is a write, and a server component that writes while
 * rendering runs again on every revalidation.
 */
export function MarkRead({ threadId }: { threadId: string }) {
  useEffect(() => {
    void markThreadRead(threadId);
  }, [threadId]);

  return null;
}
