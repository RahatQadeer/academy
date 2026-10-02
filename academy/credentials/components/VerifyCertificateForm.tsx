"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/base/components/Button";
import { credentialVerifyPath, normalizeCredentialPublicId } from "../utils/publicId";

export function VerifyCertificateForm({ initialCode = "" }: { initialCode?: string }) {
  const router = useRouter();
  const [code, setCode] = useState(initialCode);
  const [pending, startTransition] = useTransition();
  const [focused, setFocused] = useState(false);

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        const next = normalizeCredentialPublicId(code);
        if (!next) return;
        startTransition(() => {
          router.push(credentialVerifyPath(next));
        });
      }}
      className="overflow-hidden rounded-[12px] border border-line bg-surface"
      style={{
        boxShadow: "0 1px 2px rgba(15,15,15,.04), 0 10px 28px rgba(15,15,15,.04)",
      }}
    >
      <div className="px-5 pb-4 pt-5">
        <div className="mb-4 flex items-start gap-3">
          <span
            className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px]"
            style={{
              background: "color-mix(in srgb, var(--module-academy-fg) 12%, white)",
              color: "var(--module-academy-fg)",
            }}
            aria-hidden
          >
            <SealIcon />
          </span>
          <div className="min-w-0">
            <p className="text-[14px] font-semibold tracking-[-0.1px] text-ink">
              Certificate ID
            </p>
            <p className="mt-0.5 text-[12.5px] leading-snug" style={{ color: "var(--text-tertiary)" }}>
              Enter the 7-digit ID, or the printed form with a prefix (for example PA-SE-1234567).
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-stretch">
          <label className="relative min-w-0 flex-1">
            <span className="sr-only">Certificate ID</span>
            <input
              name="certificateId"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              placeholder="1234567 or PA-SE-1234567"
              autoComplete="off"
              spellCheck={false}
              className="h-12 w-full rounded-[9px] border bg-surface px-3.5 font-mono text-[15px] font-medium uppercase tracking-[0.08em] text-ink outline-none transition-[border-color,box-shadow] placeholder:font-sans placeholder:normal-case placeholder:tracking-normal placeholder:text-[rgba(55,53,47,0.32)]"
              style={{
                borderColor: focused
                  ? "color-mix(in srgb, var(--module-academy-fg) 45%, var(--border-strong))"
                  : "var(--border-strong)",
                boxShadow: focused
                  ? "0 0 0 3px color-mix(in srgb, var(--module-academy-fg) 14%, transparent)"
                  : undefined,
              }}
            />
          </label>
          <Button
            type="submit"
            variant="primary"
            disabled={pending || !code.trim()}
            className="h-12 shrink-0 px-6 sm:min-w-[118px]"
          >
            {pending ? "Checking…" : "Verify"}
          </Button>
        </div>
      </div>

      <div
        className="flex flex-wrap items-center gap-1.5 border-t px-5 py-3"
        style={{ borderColor: "var(--border)", background: "var(--surface-soft)" }}
      >
        <span className="mr-1 text-[11.5px]" style={{ color: "var(--text-tertiary)" }}>
          Accepted
        </span>
        {["1234567", "PA-SE-•••••••", "PA-CC-•••••••", "PA-CPA-•••••••"].map((example) => (
          <span
            key={example}
            className="rounded-[6px] border border-line bg-surface px-2 py-0.5 font-mono text-[11px] font-medium tracking-[0.04em] text-ink"
          >
            {example}
          </span>
        ))}
      </div>
    </form>
  );
}

function SealIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 3l2.1 2.1L16.8 4l.3 2.8L20 7.5l-1.5 2.4L20 12.3l-2.9.7L16.8 16l-2.7-1.1L12 17l-2.1-2.1L7.2 16l-.3-2.8L4 12.3l1.5-2.4L4 7.5l2.9-.7L7.2 4l2.7 1.1L12 3z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M9.2 12.1l1.8 1.8 3.8-3.9"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
