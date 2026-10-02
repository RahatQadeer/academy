"use client";

import { useState } from "react";
import Link from "next/link";
import { Input } from "@/base/components/Input";
import { SubmitButton } from "@/base/components/AuthControls";
import { MailIcon } from "@/base/components/AuthIcons";
import { partnerAdminForgotPasswordAction } from "@/partner-center/admin/lib/auth-actions";
import { PA_ADMIN } from "@/partner-center/admin/lib/paths";

export function PartnerAdminForgotForm() {
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    const result = await partnerAdminForgotPasswordAction({
      email: String(form.get("email") ?? ""),
    });
    setPending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setDone(true);
  }

  if (done) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-[13.5px]" style={{ color: "var(--text-secondary)" }}>
          If that email has a Partner Admin invite or role, a reset link is on
          its way.
        </p>
        <Link href={PA_ADMIN.signin} className="text-[13.5px] font-medium">
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      {error ? (
        <p className="text-[13.5px]" style={{ color: "var(--danger-fg)" }}>
          {error}
        </p>
      ) : null}
      <Input
        name="email"
        type="email"
        label="Email"
        autoComplete="email"
        required
        icon={<MailIcon />}
      />
      <SubmitButton pending={pending}>Send reset link</SubmitButton>
      <Link href={PA_ADMIN.signin} className="text-center text-[13px]">
        Back to sign in
      </Link>
    </form>
  );
}
