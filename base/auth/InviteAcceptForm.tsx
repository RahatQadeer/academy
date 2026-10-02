"use client";

import { useState } from "react";
import { Input } from "@/base/components/Input";
import { FormError, SubmitButton } from "@/base/components/AuthControls";

export function InviteAcceptForm({
  token,
  email,
  inviteeName,
  inviterName,
  role,
  submitLabel = "Set Password & Continue",
  showRoleCallout = true,
}: {
  token: string;
  email: string;
  inviteeName: string | null;
  inviterName: string;
  role: string;
  submitLabel?: string;
  showRoleCallout?: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") ?? "");
    const confirm = String(form.get("confirmPassword") ?? "");
    if (password !== confirm) {
      setError("Passwords do not match.");
      setPending(false);
      return;
    }
    const response = await fetch("/auth/accept-invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token,
        password,
        fullName: form.get("fullName") || inviteeName,
      }),
    });
    const data = (await response.json()) as { error?: string; redirect?: string };
    if (!response.ok) {
      setError(data.error || "Could not accept invitation.");
      setPending(false);
      return;
    }
    window.location.href = data.redirect || "/switcher";
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      {showRoleCallout ? (
        <div
          className="rounded-[12px] px-3.5 py-3 text-[13.5px] leading-snug"
          style={{ background: "var(--accent-tint)", color: "var(--ink)" }}
        >
          <span className="font-semibold">{inviterName}</span>
          {" invited you as "}
          <span className="font-semibold" style={{ color: "var(--accent)" }}>
            {role}
          </span>
          .
        </div>
      ) : null}
      <Input
        label="Full Name"
        name="fullName"
        placeholder="Enter your full name"
        defaultValue={inviteeName ?? ""}
        required
      />
      <Input label="Email Address" name="email" value={email} readOnly />
      <Input
        label="Create Password"
        name="password"
        type="password"
        autoComplete="new-password"
        placeholder="At least 8 characters"
        required
        minLength={8}
        revealable
      />
      <Input
        label="Confirm Password"
        name="confirmPassword"
        type="password"
        autoComplete="new-password"
        placeholder="Re-enter password"
        required
        minLength={8}
        revealable
      />
      <FormError message={error} />
      <SubmitButton pending={pending} pendingLabel="Opening workspace…">
        {submitLabel}
      </SubmitButton>
    </form>
  );
}
