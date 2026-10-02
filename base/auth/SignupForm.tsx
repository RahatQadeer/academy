"use client";

import { useState } from "react";
import Link from "next/link";
import { Input } from "@/base/components/Input";
import {
  Divider,
  OAuthButtons,
  SubmitButton,
} from "@/base/components/AuthControls";
import { AlertIcon, LockIcon, MailIcon, UserIcon } from "@/base/components/AuthIcons";
import { passwordMeetsRules, passwordProblem } from "@/base/auth/password";
import { readAuthResponse } from "@/base/auth/readResponse";
import { authHref, partnerSignInHref, usesPartnerAuth } from "@/base/auth/query";
import { checkEmail } from "@/base/auth/email";
import { EMAIL_ALREADY_REGISTERED, EMAIL_ALREADY_REGISTERED_MESSAGE } from "@/base/lib/email";

export function SignupForm({
  nextPath,
  brand,
}: {
  nextPath: string;
  brand?: string;
}) {
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState("");
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const signInHref = usesPartnerAuth({ brand, next: nextPath })
    ? partnerSignInHref()
    : authHref("/login", { brand, next: nextPath });


  /**
   * On blur, not on every keystroke.
   *
   * `checkEmail` also spots the near-misses — gmail.con and the rest — and
   * those come back as a suggestion rather than a refusal, because gmail.co is
   * a real domain in Colombia and refusing it would lock somebody out of their
   * own address.
   */
  function validateEmail() {
    setSuggestion(null);
    if (!email.trim()) return setEmailError(null);
    const checked = checkEmail(email);
    if (!checked.ok) return setEmailError(checked.reason);
    setEmailError(null);
    if (checked.suggestion) setSuggestion(checked.suggestion);
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const checked = checkEmail(email);
    if (!checked.ok) return setEmailError(checked.reason);
    setEmailError(null);

    // Blur has usually said this already; submitting is the backstop for a
    // password typed and sent without the field ever losing focus.
    const problem = passwordProblem(password);
    if (problem) return setPasswordError(problem);
    setPasswordError(null);

    if (password !== confirm) return setConfirmError("The two passwords do not match.");
    setConfirmError(null);

    setPending(true);
    setError(null);
    try {
      const form = new FormData(event.currentTarget);
      const response = await fetch("/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          fullName: form.get("fullName"),
          email: checked.email,
          password,
          next: nextPath,
          brand,
        }),
      });
      const data = await readAuthResponse(response);
      if (!response.ok) {
        const duplicate = data.code === EMAIL_ALREADY_REGISTERED;
        setError(
          duplicate
            ? EMAIL_ALREADY_REGISTERED_MESSAGE
            : data.message || data.error || "Could not create account.",
        );
        setPending(false);
        return;
      }
      window.location.href = data.redirect || nextPath || "/switcher";
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not create account.");
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-[14px]">
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
              {error}
              {error === EMAIL_ALREADY_REGISTERED_MESSAGE ? (
                <>
                  {" "}
                  <Link href={signInHref} className="font-medium underline underline-offset-2" style={{ color: "inherit" }}>
                    Sign in instead
                  </Link>
                  .
                </>
              ) : null}
            </span>
          </div>
        ) : null}

        <Input
          label="Full Name"
          name="fullName"
          type="text"
          autoComplete="name"
          placeholder="Enter your full name"
          icon={<UserIcon />}
          required
          className="py-[10px]"
        />

        <div>
          <Input
            label="Email Address"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="Enter your email address"
            icon={<MailIcon />}
            required
            className="py-[10px]"
            value={email}
            error={emailError}
            onChange={(event) => {
              setEmail(event.target.value);
              if (emailError) setEmailError(null);
              if (suggestion) setSuggestion(null);
            }}
            onBlur={validateEmail}
          />
          {/* Offered, never applied for them: a corrected address they did not
              choose is how somebody signs up as the wrong person. */}
          {suggestion ? (
            <p className="mt-1.5 text-[12px]" style={{ color: "var(--text-secondary)" }}>
              Did you mean{" "}
              <button
                type="button"
                onClick={() => {
                  setEmail(suggestion);
                  setSuggestion(null);
                }}
                className="font-medium underline underline-offset-2"
                style={{ color: "var(--accent)" }}
              >
                {suggestion}
              </button>
              ?
            </p>
          ) : null}
        </div>

        {/* The ticking checklist that used to sit under this field is gone.
            Three permanent lines of rules pushed the card past the fold on a
            laptop, and they were three lines of telling-off for a field nobody
            had reached yet. The rules are unchanged and still enforced — they
            are simply spoken on blur, and only when one is broken, so a
            correct password costs no height at all. */}
        <Input
          label="Password"
          name="password"
          type="password"
          autoComplete="new-password"
          placeholder="Create a password"
          icon={<LockIcon />}
          revealable
          required
          className="py-[10px]"
          value={password}
          error={passwordError}
          onChange={(event) => {
            setPassword(event.target.value);
            if (passwordError) setPasswordError(null);
            if (confirmError && event.target.value === confirm) setConfirmError(null);
          }}
          // Empty is not yet a mistake — leaving a field you have not filled in
          // is how anybody tabs through a form.
          onBlur={() => {
            if (password) setPasswordError(passwordProblem(password));
          }}
        />

        <Input
          label="Confirm Password"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          placeholder="Re-enter your password"
          icon={<LockIcon />}
          revealable
          required
          className="py-[10px]"
          value={confirm}
          // Only once both are worth comparing, so it does not shout "do not
          // match" at the first character of the second field.
          error={
            confirmError ??
            (confirm.length > 0 && passwordMeetsRules(password) && password !== confirm
              ? "The two passwords do not match."
              : null)
          }
          onChange={(event) => {
            setConfirm(event.target.value);
            if (confirmError) setConfirmError(null);
          }}
        />

        <SubmitButton pending={pending} pendingLabel="Creating your account…">
          Create Account
        </SubmitButton>
      </form>

      {/* Below the form, matching sign in: the fields are what somebody came
          here to fill in. */}
      <Divider />
      <OAuthButtons nextPath={nextPath} verb="Sign up with" />

      <p className="text-center text-[13.5px]" style={{ color: "var(--text-secondary)" }}>
        Already have an account?{" "}
        <Link href={signInHref} className="font-medium no-underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
