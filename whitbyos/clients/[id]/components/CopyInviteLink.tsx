"use client";

import { useState } from "react";

/**
 * The invitation's link, to hand over when the email did not go.
 *
 * Supabase refuses to email an address that already has an account, and its
 * built-in mailer is rate-limited besides — but the link works from the moment
 * the invitation row exists, so there is always something to give.
 */
export function CopyInviteLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(url);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch {
          // Clipboard refused — the link is still selectable in the title.
        }
      }}
      title={url}
      className="text-[11.5px] font-medium underline"
      style={{ color: copied ? "var(--success-fg)" : "var(--accent)" }}
    >
      {copied ? "Copied" : "Copy invite link"}
    </button>
  );
}
