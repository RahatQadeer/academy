"use client";

import { useState } from "react";
import Link from "next/link";
import { Input } from "@/base/components/Input";
import {
  Divider,
  OAuthButtons,
  SubmitButton,
} from "@/base/components/AuthControls";
import { AlertIcon, LockIcon, MailIcon } from "@/base/components/AuthIcons";
import { Toggle } from "@/base/components/Toggle";
import { readAuthResponse } from "@/base/auth/readResponse";
import { authHref } from "@/base/auth/query";
import { checkEmail } from "@/base/auth/email";

/**
 * Whether the failure was the password rather than the service. 1.1 words a
 * rejected credential for the person; anything else is repeated as it came.
 */
function credentialsRejected(message: string) {
  return /invalid login|incorrect|credential|password/i.test(message);
}

export function LoginForm({
  nextPath,
  brand,
  initialError,
}: {
  nextPath: string;
  brand?: string;
  /** A failure the sign-in route redirected back with, shown as 1.1 draws it. */
  initialError?: string;
}) {
  const portal = brand === "portal";
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [keepSignedIn, setKeepSignedIn] = useState(true);
  const [error, setError] = useState<string | null>(initialError ?? null);
  const [pending, setPending] = useState(false);

  /**
   * Checked when the field is left rather than on every keystroke: telling
   * somebody "that is not an email" while they are still on the third letter
   * of it is nagging, not help.
   */
  function validateEmail() {
    if (!email.trim()) return setEmailError(null);
    const checked = checkEmail(email);
    setEmailError(checked.ok ? null : checked.reason);
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    // The shape is caught here rather than at the server, which would answer a
    // malformed address with "invalid login credentials" — true, and useless.
    const checked = checkEmail(email);
    if (!checked.ok) {
      setEmailError(checked.reason);
      return;
    }
    setEmailError(null);

    setPending(true);
    setError(null);
    try {
      const form = new FormData(event.currentTarget);
      const response = await fetch("/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: form.get("email"),
          password: form.get("password"),
          keepSignedIn,
          next: nextPath,
          brand,
        }),
      });
      const data = await readAuthResponse(response);
      if (!response.ok) {
        setError(data.error || "Could not sign in.");
        setPending(false);
        return;
      }
      window.location.href = data.redirect || nextPath || "/switcher";
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not sign in.");
      setPending(false);
    }
  }

  const rejected = error ? credentialsRejected(error) : false;

  return (
    // 24px between the blocks of this column, 16px between the fields inside
    // it, which is what the export sets.
    <div className="flex flex-col gap-6">
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-[18px]">
        {error ? (
          <div
            className="flex items-start gap-2.5 rounded-control px-3.5 py-[11px]"
            style={{ background: "var(--danger-bg)", color: "var(--danger-fg)" }}
            role="alert"
          >
            <span className="mt-px shrink-0" aria-hidden>
              <AlertIcon size={15} />
            </span>
            <span className="text-[13.5px] leading-[1.45]">
              {/* Which of the two was wrong is deliberately not said. The
                  provider answers both the same way, and it is right to:
                  telling somebody "no account has that email" lets anyone
                  check whether an address is a customer of yours. */}
              {rejected
                ? "The email or password you entered is incorrect. Please check both and try again."
                : error}
            </span>
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
          className="py-[11px]"
          value={email}
          // Marked, but not spoken to: the sentence above says it once for
          // both fields rather than twice.
          error={emailError ?? rejected}
          onChange={(event) => {
            setEmail(event.target.value);
            if (emailError) setEmailError(null);
          }}
          onBlur={validateEmail}
        />

        <Input
          label="Password"
          name="password"
          type="password"
          autoComplete="current-password"
          placeholder="Enter your password"
          icon={<LockIcon />}
          revealable
          required
          className="py-[11px]"
          error={rejected ? "Incorrect email or password" : null}
        />

        {/* Under the field rather than on the label row beside "Password".
            The export draws it on the label row; Sabahat asked for it here,
            where it reads as the way out of the field you have just failed at
            rather than as a second label. */}
        <div className="-mt-2 flex justify-end">
          <Link
            href={authHref("/forgot-password", { brand, next: nextPath })}
            className="text-[12.5px] font-medium no-underline"
          >
            Forgot password?
          </Link>
        </div>

        {portal ? null : (
          <Toggle
            checked={keepSignedIn}
            onChange={setKeepSignedIn}
            label="Keep me signed in"
          />
        )}
        <SubmitButton pending={pending} pendingLabel="Signing in…">
          Sign in
        </SubmitButton>
      </form>

      {/* Under the form rather than over it: the address and password are what
          somebody came here to type, and Google is the other way in for the
          people who use it. */}
      {portal ? null : (
        <>
          <Divider />
          <OAuthButtons nextPath={nextPath} />
        </>
      )}

      {portal ? (
        <p className="text-center text-[13.5px]" style={{ color: "var(--text-secondary)" }}>
          New client? You&apos;ll need an invitation from your account to create
          an account.
        </p>
      ) : (
        <p className="text-center text-[13.5px]" style={{ color: "var(--text-secondary)" }}>
          Don&apos;t have an account?{" "}
          <Link
            href={authHref("/signup", { brand, next: nextPath })}
            className="font-medium no-underline"
          >
            Sign up
          </Link>
        </p>
      )}
    </div>
  );
}
