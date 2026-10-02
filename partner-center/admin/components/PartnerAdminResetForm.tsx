"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/base/components/Input";
import { SubmitButton } from "@/base/components/AuthControls";
import { LockIcon } from "@/base/components/AuthIcons";
import { partnerAdminResetPasswordAction } from "@/partner-center/admin/lib/auth-actions";
import { PARTNER_ADMIN_PASSWORD_MIN } from "@/partner-center/admin/lib/shared";
import { PA_ADMIN } from "@/partner-center/admin/lib/paths";

export function PartnerAdminResetForm() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    const result = await partnerAdminResetPasswordAction({
      password: String(form.get("password") ?? ""),
      confirmPassword: String(form.get("confirmPassword") ?? ""),
    });
    setPending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    router.replace(result.redirectTo ?? PA_ADMIN.signin);
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      {error ? (
        <p className="text-[13.5px]" style={{ color: "var(--danger-fg)" }}>
          {error}
        </p>
      ) : null}
      <Input
        name="password"
        type="password"
        label="New password"
        autoComplete="new-password"
        required
        minLength={PARTNER_ADMIN_PASSWORD_MIN}
        icon={<LockIcon />}
      />
      <Input
        name="confirmPassword"
        type="password"
        label="Confirm password"
        autoComplete="new-password"
        required
        minLength={PARTNER_ADMIN_PASSWORD_MIN}
        icon={<LockIcon />}
      />
      <p className="text-[12.5px]" style={{ color: "var(--text-secondary)" }}>
        At least {PARTNER_ADMIN_PASSWORD_MIN} characters, one number, and one
        uppercase letter.
      </p>
      <SubmitButton pending={pending}>Update password</SubmitButton>
    </form>
  );
}
