"use client";

import { useFormStatus } from "react-dom";

/**
 * 3.2.1's Send.
 *
 * Its own button rather than the Requests hero's: that one says "Draft with
 * Whitby" and dims the whole form behind an overlay, which is right for a first
 * draft and wrong for a reply in a conversation. Here the wait is short and the
 * thread should stay readable while it happens.
 */
export function SendButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="shrink-0 rounded-control px-3.5 py-[7px] text-[13px] font-medium text-white disabled:opacity-60"
      style={{ background: "var(--accent)" }}
    >
      {pending ? "Thinking…" : "Send"}
    </button>
  );
}
