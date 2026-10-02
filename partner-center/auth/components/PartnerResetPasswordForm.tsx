"use client";

import { useState } from "react";
import { Input } from "@/base/components/Input";
import { FormError, SubmitButton } from "@/base/components/AuthControls";

const PASSWORD_HINT = "At least 8 characters, one number, one symbol.";

function passwordProblem(password: string) {
  if (password.length < 8) return PASSWORD_HINT;
  if (!/[0-9]/.test(password)) return PASSWORD_HINT;
  if (!/[^A-Za-z0-9]/.test(password)) return PASSWORD_HINT;
  return null;
}

export function PartnerResetPasswordForm() {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const form = new FormData(event.currentTarget);
      const password = String(form.get("password") ?? "");
      const confirm = String(form.get("confirmPassword") ?? "");
      const problem = passwordProblem(password);
      if (problem) {
        setError(problem);
        return;
      }
      if (password !== confirm) {
        setError("Passwords do not match.");
        return;
      }
      const response = await fetch("/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = (await response.json()) as { error?: string; redirect?: string };
      if (!response.ok) {
        setError(data.error || "Could not update password.");
        return;
      }
      window.location.href = "/partner-center";
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not update password.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Input
        label="New password"
        name="password"
        type="password"
        autoComplete="new-password"
        required
        minLength={8}
        hint={PASSWORD_HINT}
      />
      <Input
        label="Confirm new password"
        name="confirmPassword"
        type="password"
        autoComplete="new-password"
        required
        minLength={8}
      />
      <FormError message={error} />
      <SubmitButton pending={pending}>Reset password</SubmitButton>
    </form>
  );
}
