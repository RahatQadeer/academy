"use client";

import { useState } from "react";
import { Input } from "@/base/components/Input";
import { Button } from "@/base/components/Button";

export function SuperAdminLoginForm({
  initialError,
}: {
  initialError?: string;
}) {
  const [error, setError] = useState<string | null>(initialError ?? null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const form = new FormData(event.currentTarget);
      const response = await fetch("/api/super-admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: form.get("email"),
          password: form.get("password"),
        }),
      });
      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
        redirect?: string;
      };
      if (!response.ok) {
        setError(data.error || "Could not sign in.");
        return;
      }
      window.location.href = data.redirect || "/super-admin";
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not sign in.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      {error ? (
        <div
          className="rounded-control px-3.5 py-[11px] text-[13.5px] leading-[1.4]"
          style={{ background: "var(--danger-bg)", color: "var(--danger-fg)" }}
          role="alert"
        >
          {error}
        </div>
      ) : null}

      <Input
        label="Email"
        name="email"
        type="email"
        autoComplete="username"
        required
      />
      <Input
        label="Password"
        name="password"
        type="password"
        autoComplete="current-password"
        required
      />

      <Button type="submit" variant="primary" fullWidth disabled={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
