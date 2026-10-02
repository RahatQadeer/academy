"use client";

import { useState } from "react";
import { Input } from "@/base/components/Input";
import { SubmitButton } from "@/base/components/AuthControls";
import { AlertIcon, MailIcon } from "@/base/components/AuthIcons";
import { checkEmail } from "@/base/auth/email";
import Link from "next/link";

export function ForgotPasswordForm({
  signInHref = "/login",
}: {
  signInHref?: string;
}) {
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function send(address: string) {
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: address }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(data.error || "Could not send the reset email.");
        return;
      }
      setSent(address);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not send the reset email.");
    } finally {
      setPending(false);
    }
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // Checked here rather than at the server, which would happily accept
    // "abc@gmail" and report success for an address that can never arrive.
    const checked = checkEmail(email);
    if (!checked.ok) return setEmailError(checked.reason);
    setEmailError(null);
    await send(checked.email);
  }

  if (sent) {
    return (
      <div className="flex flex-col gap-5">
        <div
          className="flex items-start gap-3 rounded-[10px] px-4 py-3.5"
          style={{ background: "var(--surface-soft)" }}
        >
          <span className="mt-0.5 shrink-0" style={{ color: "var(--accent)" }} aria-hidden>
            <MailIcon size={18} />
          </span>
          <div className="min-w-0">
            <div className="text-[14px] font-semibold">Check your inbox</div>
            <p className="mt-1 text-[13.5px] leading-[1.6]" style={{ color: "var(--text-secondary)" }}>
              {/* Never "we sent you an email": confirming which addresses have
                  accounts tells anyone who asks who is a customer. */}
              If an account exists for <strong style={{ color: "var(--ink)" }}>{sent}</strong>, a
              link to choose a new password is on its way. It expires in an hour.
            </p>
          </div>
        </div>

        <p className="text-[13px] leading-[1.6]" style={{ color: "var(--text-tertiary)" }}>
          Nothing yet? Check the spam folder, or{" "}
          <button
            type="button"
            onClick={() => send(sent)}
            disabled={pending}
            className="font-medium underline underline-offset-2 disabled:opacity-60"
            style={{ color: "var(--accent)" }}
          >
            {pending ? "sending…" : "send it again"}
          </button>
          .
        </p>

        {error ? (
          <p className="text-[12.5px]" style={{ color: "var(--danger-fg)" }} role="alert">
            {error}
          </p>
        ) : null}

        <Link href={signInHref} className="text-[13.5px] font-medium no-underline">
          ← Back to sign in
        </Link>
      </div>
    );
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

      <Input
        label="Email Address"
        name="email"
        type="email"
        inputMode="email"
        autoComplete="email"
        placeholder="Enter your email address"
        icon={<MailIcon />}
        required
        autoFocus
        value={email}
        error={emailError}
        onChange={(event) => {
          setEmail(event.target.value);
          if (emailError) setEmailError(null);
        }}
        onBlur={() => {
          if (!email.trim()) return setEmailError(null);
          const checked = checkEmail(email);
          setEmailError(checked.ok ? null : checked.reason);
        }}
      />

      <SubmitButton pending={pending} pendingLabel="Sending…">
        Send reset link
      </SubmitButton>

      <p className="text-center text-[13.5px]">
        <Link href={signInHref} className="no-underline" style={{ color: "var(--text-secondary)" }}>
          ← Back to sign in
        </Link>
      </p>
    </form>
  );
}
