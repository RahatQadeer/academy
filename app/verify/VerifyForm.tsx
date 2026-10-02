"use client";

import { useState } from "react";
import { Callout } from "@/base/components/Callout";
import { Input } from "@/base/components/Input";
import { FormError, SubmitButton } from "@/base/components/AuthControls";
import { createClient } from "@/base/lib/supabase/client";

/**
 * Screen 1.2 — the code, after the password.
 *
 * Verified in the browser rather than through a route, because the challenge
 * and the verify have to happen on the same session, and it is the browser's
 * session that needs upgrading. Getting it right on the server would mean
 * handing the session back and forth for no gain.
 */
export function VerifyForm({ next }: { next: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);

    const form = new FormData(event.currentTarget);
    const code = String(form.get("code") ?? "").replace(/\s/g, "");

    if (code.length !== 6) {
      setError("Enter the six digits from your authenticator app.");
      setPending(false);
      return;
    }

    const supabase = createClient();

    const { data: factors, error: listError } = await supabase.auth.mfa.listFactors();
    const factor = (factors?.all ?? []).find((row) => row.status === "verified");

    if (listError || !factor) {
      setError(
        "No authenticator is set up on this account. Sign in again, or ask an Owner or Admin for help.",
      );
      setPending(false);
      return;
    }

    const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
      factorId: factor.id,
    });

    if (challengeError || !challenge) {
      setError(challengeError?.message ?? "Could not check that code. Try again.");
      setPending(false);
      return;
    }

    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId: factor.id,
      challengeId: challenge.id,
      code,
    });

    if (verifyError) {
      setError(verifyError.message);
      setPending(false);
      return;
    }

    // A full reload rather than a router push: the session was just upgraded,
    // and the middleware has to see the new one to stop sending them back here.
    window.location.href = next;
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Callout tone="info">
        Your password was accepted. Enter the code from your authenticator app to
        finish signing in.
      </Callout>

      <Input
        id="code"
        name="code"
        label="Six-digit code"
        placeholder="123456"
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={7}
        autoFocus
        required
      />

      <FormError message={error} />

      <SubmitButton pending={pending}>Verify and continue</SubmitButton>

      <p className="text-center text-[12.5px]" style={{ color: "var(--text-secondary)" }}>
        Lost your authenticator? There are no backup codes — an Owner or Admin
        has to turn two-factor off for you before you can sign in again.
      </p>
    </form>
  );
}
