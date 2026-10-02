"use client";

import { useState } from "react";
import { Input } from "@/base/components/Input";
import { SubmitButton } from "@/base/components/AuthControls";
import { AlertIcon, LockIcon } from "@/base/components/AuthIcons";
import { PasswordRules, passwordMeetsRules, passwordProblem } from "@/base/auth/password";

export function ResetPasswordForm({ tokenHash }: { tokenHash?: string | null }) {
  const [password, setPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState("");
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    // The same three rules the list under the field ticks. They used to be
    // shown and not applied: `minLength={8}` was the whole check, so a
    // password meeting one rule out of three was accepted.
    const problem = passwordProblem(password);
    if (problem) return setPasswordError(problem);
    setPasswordError(null);

    if (password !== confirm) return setConfirmError("The two passwords do not match.");
    setConfirmError(null);

    setPending(true);
    setError(null);
    try {
      const response = await fetch("/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // The recovery token travels with the new password, so it is redeemed
        // by this request and not by whatever fetched the link first.
        body: JSON.stringify({ password, token_hash: tokenHash ?? undefined }),
      });
      const data = (await response.json()) as { error?: string; redirect?: string };
      if (!response.ok) {
        setError(data.error || "Could not update the password.");
        return;
      }
      window.location.href = data.redirect || "/password-updated";
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not update the password.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      {error ? (
        <div
          className="flex items-start gap-2.5 rounded-control px-3.5 py-[11px]"
          style={{ background: "var(--danger-bg)", color: "var(--danger-fg)" }}
          role="alert"
        >
          <span className="mt-px shrink-0" aria-hidden>
            <AlertIcon size={15} />
          </span>
          <span className="text-[13.5px] leading-[1.45]">{error}</span>
        </div>
      ) : null}

      <div className="flex flex-col gap-2.5">
        <Input
          label="New Password"
          name="password"
          type="password"
          autoComplete="new-password"
          placeholder="Enter a new password"
          icon={<LockIcon />}
          revealable
          required
          autoFocus
          value={password}
          error={passwordError}
          onChange={(event) => {
            setPassword(event.target.value);
            if (passwordError) setPasswordError(null);
            if (confirmError && event.target.value === confirm) setConfirmError(null);
          }}
        />
        {/* 3.2 shows the three rules and ticks them as they are met, rather
            than waiting for the server to reject the password. */}
        <PasswordRules value={password} />
      </div>

      <Input
        label="Confirm Password"
        name="confirmPassword"
        type="password"
        autoComplete="new-password"
        placeholder="Re-enter the new password"
        icon={<LockIcon />}
        revealable
        required
        value={confirm}
        error={
          confirmError ??
          (confirm.length > 0 && passwordMeetsRules(password) && password !== confirm
            ? "The two passwords do not match."
            : null)
        }
        onChange={(event) => {
          setConfirm(event.target.value);
          if (confirmError) setConfirmError(null);
        }}
      />

      <SubmitButton pending={pending} pendingLabel="Saving…">
        Reset password
      </SubmitButton>
    </form>
  );
}
