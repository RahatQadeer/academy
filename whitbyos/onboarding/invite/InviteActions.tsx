"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

const PRIMARY =
  "inline-flex items-center justify-center rounded-[10px] px-5 py-[10px] text-[14px] font-semibold text-white no-underline hover:!text-white";
const SECONDARY =
  "inline-flex items-center justify-center rounded-[10px] border border-line-strong bg-surface px-5 py-[10px] text-[14px] font-semibold text-ink no-underline shadow-[0_1px_0_rgba(255,255,255,.8)] hover:bg-[var(--accent-tint)] hover:!text-ink";

/**
 * Skip is the way through while the rows are empty. The send button only
 * turns blue once at least one real email is in the form.
 */
export function InviteActions() {
  const root = useRef<HTMLDivElement>(null);
  const [hasInvites, setHasInvites] = useState(false);

  useEffect(() => {
    const form = root.current?.closest("form");
    if (!form) return;

    const look = () => {
      const emails = Array.from(
        form.querySelectorAll<HTMLInputElement>('input[name="email"]'),
      );
      const filled = emails.filter((field) => field.value.trim().length > 0);
      setHasInvites(
        filled.length > 0 && filled.every((field) => field.checkValidity()),
      );
    };

    look();
    form.addEventListener("input", look);
    form.addEventListener("change", look);
    const watch = new MutationObserver(look);
    watch.observe(form, { childList: true, subtree: true });

    return () => {
      form.removeEventListener("input", look);
      form.removeEventListener("change", look);
      watch.disconnect();
    };
  }, []);

  return (
    <div ref={root} className="flex items-center gap-2.5">
      {hasInvites ? (
        <>
          <Link href="/onboarding/ready" className={SECONDARY}>
            Skip
          </Link>
          <button
            type="submit"
            className={PRIMARY}
            style={{
              background: "var(--accent)",
              boxShadow: "0 8px 18px -12px rgba(31,72,125,.9)",
            }}
          >
            Send invites &amp; continue
          </button>
        </>
      ) : (
        <Link
          href="/onboarding/ready"
          className={PRIMARY}
          style={{
            background: "var(--accent)",
            boxShadow: "0 8px 18px -12px rgba(31,72,125,.9)",
          }}
        >
          Skip
        </Link>
      )}
    </div>
  );
}
