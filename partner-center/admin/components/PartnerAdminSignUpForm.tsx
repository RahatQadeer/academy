"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/base/components/Input";
import { SubmitButton } from "@/base/components/AuthControls";
import { LockIcon } from "@/base/components/AuthIcons";
import { partnerAdminSignUpAction } from "@/partner-center/admin/lib/auth-actions";
import {
  PARTNER_ADMIN_PASSWORD_MIN,
} from "@/partner-center/admin/lib/shared";
import { PA_ADMIN } from "@/partner-center/admin/lib/paths";

export function PartnerAdminSignUpForm({
  token,
  email,
}: {
  token: string;
  email: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  // Supabase Accept-invite sometimes appends #error=otp_expired on this URL.
  // Strip it so the password form is the only flow (token in the query is enough).
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.location.hash.includes("error")) {
      const clean = `${window.location.pathname}${window.location.search}`;
      window.history.replaceState(null, "", clean);
    }
  }, []);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    const result = await partnerAdminSignUpAction({
      token,
      password: String(form.get("password") ?? ""),
      confirmPassword: String(form.get("confirmPassword") ?? ""),
    });
    setPending(false);
    if (result.error) {
      setError(result.error);
      if (result.redirectTo) {
        setTimeout(() => router.replace(result.redirectTo!), 1200);
      }
      return;
    }
    router.replace(result.redirectTo ?? PA_ADMIN.root);
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
        value={email}
        readOnly
        disabled
      />
      <Input
        name="password"
        type="password"
        label="Password"
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
      <SubmitButton pending={pending}>Continue to dashboard</SubmitButton>
    </form>
  );
}
