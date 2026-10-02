"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/base/lib/supabase/client";
import { emailConfirmRedirect } from "@/base/auth/site";
import { FormError } from "@/base/components/AuthControls";

export function CheckEmailPanel({
  email,
  reset = false,
}: {
  email?: string;
  /** 3.1 rather than 2.1: a reset link, not a first confirmation. */
  reset?: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [pending, setPending] = useState(false);

  async function resend() {
    if (!email) return;
    setPending(true);
    setError(null);
    try {
      const supabase = createClient();
      const { error: resendError } = await supabase.auth.resend({
        type: "signup",
        email,
        options: { emailRedirectTo: emailConfirmRedirect() },
      });
      if (resendError) {
        setError(resendError.message);
        return;
      }
      setSent(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not resend the email.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex w-full flex-col items-center gap-5">
      <p className="text-[14.5px] leading-[1.5]" style={{ color: "var(--text-secondary)" }}>
        {reset ? "We've sent password reset instructions" : "We sent a confirmation link"}
        {email ? (
          <>
            {" to "}
            <span className="font-medium" style={{ color: "var(--ink)" }}>
              {email}
            </span>
          </>
        ) : (
          " to your inbox"
        )}
      </p>

      {/* The export offers this on both screens. It is a hint to the browser
          rather than a link anywhere: mailto with no address opens the
          default mail client on the reader's own machine. */}
      <a
        href="mailto:"
        className="w-full rounded-control border border-line-strong bg-surface px-4 py-[10px] text-center text-[14.5px] font-medium no-underline"
        style={{ color: "var(--ink)" }}
      >
        Open email app
      </a>

      {email ? (
        <p className="text-[13.5px]" style={{ color: "var(--text-secondary)" }}>
          {reset ? "Didn't get the email?" : "Didn't get it?"}{" "}
          <button
            type="button"
            disabled={pending || sent}
            onClick={() => void resend()}
            className="font-medium disabled:opacity-60"
            style={{ color: "var(--accent)" }}
          >
            {pending ? "Sending…" : sent ? "Sent again" : reset ? "Resend" : "Resend link"}
          </button>
        </p>
      ) : null}

      <FormError message={error} />

      {reset ? (
        <Link href="/login" className="text-[13.5px] no-underline">
          ← Back to sign in
        </Link>
      ) : (
        <div
          className="w-full rounded-control px-3.5 py-[11px] text-left text-[12.5px] leading-[1.5]"
          style={{ background: "var(--surface-subtle)", color: "var(--text-muted)" }}
        >
          This link expires in 30 minutes. Clicking it verifies your email and
          takes you straight into onboarding.
        </div>
      )}
    </div>
  );
}
