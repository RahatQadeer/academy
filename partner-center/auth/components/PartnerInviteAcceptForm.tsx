"use client";

import { useState } from "react";
import { Input } from "@/base/components/Input";
import { FormError, SubmitButton } from "@/base/components/AuthControls";
import { Callout } from "@/base/components/Callout";
import { acceptPartnerTeamInviteAction } from "@/partner-center/auth/lib/accept-invite-action";

export function PartnerInviteAcceptForm({
  token,
  email,
  inviteeName,
  inviterName,
  role,
}: {
  token: string;
  email: string;
  inviteeName: string | null;
  inviterName: string;
  role: string;
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

    const result = await acceptPartnerTeamInviteAction({
      token,
      password,
      fullName: String(form.get("fullName") || inviteeName || ""),
    });

    if (result.error) {
      setError(result.error);
      setPending(false);
      return;
    }

    window.location.href = result.redirect || "/partner-center";
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Callout>
        {inviterName} invited you as {role}.
      </Callout>
      <Input
        label="Full Name"
        name="fullName"
        defaultValue={inviteeName ?? ""}
        required
      />
      <Input label="Email Address" name="email" value={email} readOnly />
      <Input
        label="Create Password"
        name="password"
        type="password"
        autoComplete="new-password"
        required
        minLength={8}
      />
      <Input
        label="Confirm Password"
        name="confirmPassword"
        type="password"
        autoComplete="new-password"
        required
        minLength={8}
      />
      <FormError message={error} />
      <SubmitButton pending={pending}>Accept invitation & continue</SubmitButton>
    </form>
  );
}
