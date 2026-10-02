"use client";

import { useState } from "react";
import { createClient } from "@/base/lib/supabase/client";
import { siteUrl } from "@/base/auth/site";
import { Button } from "@/base/components/Button";
import { FormError } from "@/base/components/AuthControls";

export function PartnerCheckEmailPanel({ email }: { email?: string }) {
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
        options: {
          emailRedirectTo: `${siteUrl()}/auth/callback?next=/partner-center/onboarding`,
        },
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
    <div>
      <p className="text-[16px] leading-relaxed text-center" style={{ color: "var(--text-secondary)" }}>
        We sent a confirmation link
        {email ? (
          <>
            {" "}
            to <span className="font-medium" style={{ color: "var(--ink)" }}>{email}</span>
          </>
        ) : (
          " to your inbox"
        )}
        . Open that email and click the link to confirm your account.
      </p>
      <p className="mt-3 text-[13.5px] text-center" style={{ color: "var(--text-tertiary)" }}>
        The link can take a minute. Check spam if it is not in your inbox.
      </p>
      {email ? (
        <div className="mt-6">
          <Button type="button" variant="secondary" fullWidth disabled={pending} onClick={() => void resend()}>
            {pending ? "Sending…" : sent ? "Link sent again" : "Resend email"}
          </Button>
        </div>
      ) : null}
      <FormError message={error} />
    </div>
  );
}
