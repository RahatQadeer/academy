"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/base/components/Input";
import { SubmitButton } from "@/base/components/AuthControls";
import { LockIcon, MailIcon } from "@/base/components/AuthIcons";
import { partnerAdminSignInAction } from "@/partner-center/admin/lib/auth-actions";
import { PA_ADMIN } from "@/partner-center/admin/lib/paths";
import Link from "next/link";

export function PartnerAdminSignInForm({
  initialEmail = "",
  initialError,
  nextPath,
}: {
  initialEmail?: string;
  initialError?: string;
  nextPath?: string;
}) {
  const router = useRouter();
  const [email, setEmail] = useState(initialEmail);
  const [error, setError] = useState<string | null>(initialError ?? null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    const result = await partnerAdminSignInAction({
      email: String(form.get("email") ?? ""),
      password: String(form.get("password") ?? ""),
      next: nextPath,
    });
    setPending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    router.replace(result.redirectTo ?? PA_ADMIN.root);
    router.refresh();
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
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        icon={<MailIcon />}
      />
      <Input
        name="password"
        type="password"
        label="Password"
        autoComplete="current-password"
        required
        icon={<LockIcon />}
      />
      <div className="flex justify-end">
        <Link
          href={PA_ADMIN.forgotPassword}
          className="text-[13px]"
          style={{ color: "var(--text-secondary)" }}
        >
          Forgot password?
        </Link>
      </div>
      <SubmitButton pending={pending}>Sign in</SubmitButton>
    </form>
  );
}
