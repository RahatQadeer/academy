"use client";

import { useState } from "react";

/** 17.1's Copy, beside the workspace URL. */
export function CopyUrl({ url }: { url: string }) {
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
          // Refused by the browser; the field beside this is selectable.
        }
      }}
      className="shrink-0 rounded-control border border-line-strong px-3.5 text-[13px] font-medium"
      style={{ background: "var(--surface)", color: copied ? "var(--success-fg)" : "var(--ink)" }}
    >
      {copied ? "Copied" : "Copy"}
    </button>
  );
}
