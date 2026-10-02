"use client";

import { useState } from "react";
import { Button } from "@/base/components/Button";
import { cn } from "@/base/lib/cn";

/**
 * The hosted sign-in screens 1 and 2 offer, drawn as the export draws it:
 * white, a grey outline, the brand mark at 16px, 10px by 16px.
 *
 * Google alone. Microsoft was drawn beside it and had never worked — Azure is
 * not enabled on this project, so pressing it went to the provider, failed
 * there, and came back as a sentence. Offering a way in that cannot be taken
 * is worse than not offering it.
 */
export function OAuthButtons({
  nextPath = "/switcher",
  verb = "Continue with",
}: {
  nextPath?: string;
  verb?: string;
}) {
  return (
    <div className="flex flex-col gap-2.5">
      <OAuthButton provider="google" label={`${verb} Google`} nextPath={nextPath} />
    </div>
  );
}

export function GoogleButton({
  label = "Continue with Google",
  nextPath = "/switcher",
}: {
  label?: string;
  nextPath?: string;
}) {
  return <OAuthButton provider="google" label={label} nextPath={nextPath} />;
}

function OAuthButton({
  provider,
  label,
  nextPath,
}: {
  provider: "google";
  label: string;
  nextPath: string;
}) {
  const [pending, setPending] = useState(false);

  // The browser SDK used to build this URL here, and when its promise never
  // settled the button sat on "Redirecting…" with nothing to click and no way
  // to the provider. The route does the same work on the server, where the
  // PKCE verifier is written as a cookie the callback can read: one
  // navigation, nothing to hang.
  function onClick() {
    const next = nextPath.startsWith("/onboarding") ? "/switcher" : nextPath || "/switcher";
    setPending(true);
    window.location.assign(`/auth/${provider}?next=${encodeURIComponent(next)}`);
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      aria-busy={pending}
        className={cn(
        "flex w-full items-center justify-center gap-2.5 rounded-[8px] border border-line-strong bg-surface px-4 py-[12px] text-[14.5px] font-medium",
        "transition-[background-color,border-color,transform] duration-150",
        pending
          ? "cursor-wait opacity-70"
          : "hover:-translate-y-px hover:border-[var(--text-quiet)] hover:bg-[var(--surface-soft)] active:translate-y-0",
      )}
    >
      {pending ? <Spinner /> : <GoogleMark />}
      {pending ? "Taking you to Google…" : label}
    </button>
  );
}

/** Matches the one `Submit` draws, so a pending button looks the same anywhere. */
function Spinner() {
  return (
    <svg viewBox="0 0 16 16" width="15" height="15" className="shrink-0 animate-spin" aria-hidden>
      <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="2" opacity=".25" />
      <path d="M8 2a6 6 0 0 1 6 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function Divider({ label = "or" }: { label?: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="h-px flex-1 bg-line" />
      <span className="text-[12px]" style={{ color: "var(--text-faint)" }}>
        {label}
      </span>
      <span className="h-px flex-1 bg-line" />
    </div>
  );
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" width="16" height="16" className="shrink-0" aria-hidden>
      <path fill="#4285F4" d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v9h11.8c-.51 2.75-2.06 5.09-4.39 6.65v5.52h7.09c4.15-3.82 6.62-9.47 6.62-16.17z" />
      <path fill="#34A853" d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.09-5.52c-1.97 1.32-4.49 2.11-7.47 2.11-5.73 0-10.58-3.87-12.32-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46z" />
      <path fill="#FBBC05" d="M11.68 28.18C11.24 26.86 11 25.45 11 24s.24-2.86.68-4.18v-5.7H4.34C2.85 17.09 2 20.45 2 24s.85 6.91 2.34 9.88l7.34-5.7z" />
      <path fill="#EA4335" d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.96 6.93 4.34 14.12l7.34 5.7c1.74-5.2 6.59-9.07 12.32-9.07z" />
    </svg>
  );
}


export function FormError({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <p className="mt-3 text-[13px]" style={{ color: "var(--danger-fg)" }}>
      {message}
    </p>
  );
}

export function SubmitButton({
  children,
  pending,
  pendingLabel = "Working…",
}: {
  children: React.ReactNode;
  pending?: boolean;
  pendingLabel?: string;
}) {
  return (
    <Button
      type="submit"
      variant="primary"
      fullWidth
      unsized
      disabled={pending}
      className="h-[46px] rounded-control px-5 text-[15px] font-semibold tracking-[-0.2px] transition-[background-color,transform] duration-150 hover:-translate-y-px hover:bg-accent-hover hover:!text-white active:translate-y-0"
    >
      {pending ? pendingLabel : (
        <span className="inline-flex items-center gap-2">
          {children}
          <span aria-hidden className="text-[16px] leading-none">→</span>
        </span>
      )}
    </Button>
  );
}
