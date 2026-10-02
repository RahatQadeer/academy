"use client";

import { useState } from "react";
import { Input } from "@/base/components/Input";
import {
  Divider,
  FormError,
  GoogleButton,
  SubmitButton,
} from "@/base/components/AuthControls";
import { readAuthResponse } from "@/base/auth/readResponse";

export function PartnerSignupForm() {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const form = new FormData(event.currentTarget);
      const email = String(form.get("email") ?? "");
      const password = String(form.get("password") ?? "");
      const confirm = String(form.get("confirmPassword") ?? "");
      if (password !== confirm) {
        setError("Passwords do not match.");
        return;
      }
      const response = await fetch("/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: form.get("fullName"),
          email,
          password,
          next: "/partner-center/onboarding",
        }),
      });
      const data = await readAuthResponse(response);
      if (!response.ok) {
        setError(data.error || "Could not create account.");
        return;
      }
      if (data.redirect && data.redirect.includes("check-email")) {
        const encodedEmail = encodeURIComponent(email);
        window.location.href = `/partner-center/check-email?email=${encodedEmail}`;
        return;
      }
      window.location.href = data.redirect || "/partner-center/onboarding";
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not create account.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      <GoogleButton label="Continue with Google" nextPath="/partner-center/onboarding" />
      <Divider />
      <form onSubmit={onSubmit} className="space-y-4">
        <Input label="Full Name" name="fullName" type="text" autoComplete="name" required />
        <Input
          label="Email Address"
          name="email"
          type="email"
          autoComplete="email"
          required
        />
        <Input
          label="Password"
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
        <SubmitButton pending={pending}>Create Account</SubmitButton>
      </form>
    </div>
  );
}
