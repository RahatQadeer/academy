"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Button } from "@/base/components/Button";
import { Input } from "@/base/components/Input";
import { inviteAcademyAdminAction, searchUsersForAdminGrantAction } from "../actions";
import type { AdminGrantCandidate } from "../types";
import { USER_SEARCH_MIN } from "../types";

type LookupStatus = "idle" | "checking" | "found" | "new" | "error";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function lookupAdminUser(
  query: string,
): Promise<
  | { status: "found"; user: AdminGrantCandidate }
  | { status: "new" }
  | { status: "invalid" }
  | { status: "error"; message: string }
> {
  const trimmed = query.trim();
  if (trimmed.length < USER_SEARCH_MIN) {
    return { status: "invalid" };
  }

  const result = await searchUsersForAdminGrantAction(trimmed);
  if (!result.ok) {
    return { status: "error", message: result.message || "Could not look up this email." };
  }

  const exact = result.data.users.find(
    (user) => user.email?.toLowerCase() === trimmed.toLowerCase(),
  );
  if (exact) return { status: "found", user: exact };
  if (EMAIL_PATTERN.test(trimmed)) return { status: "new" };
  return result.data.users[0]
    ? { status: "found", user: result.data.users[0] }
    : { status: "new" };
}

export function AddAdminModal({
  onClose,
  onGranted,
}: {
  onClose: () => void;
  onGranted: (details: {
    displayName: string;
    email: string;
    mode: "existing" | "invited";
    emailSent?: boolean;
    message?: string;
  }) => void;
}) {
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [matchedUser, setMatchedUser] = useState<AdminGrantCandidate | null>(null);
  const [lookupStatus, setLookupStatus] = useState<LookupStatus>("idle");
  const [lookupMessage, setLookupMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitPending, startSubmit] = useTransition();
  const nameEditedRef = useRef(false);
  const lookupRequestRef = useRef(0);

  useEffect(() => {
    const trimmed = email.trim();
    if (!EMAIL_PATTERN.test(trimmed)) {
      setMatchedUser(null);
      setLookupStatus("idle");
      setLookupMessage(
        trimmed.length > 0 && !EMAIL_PATTERN.test(trimmed)
          ? "Enter a valid email address."
          : null,
      );
      return;
    }

    setLookupStatus("checking");
    setLookupMessage(null);

    const requestId = ++lookupRequestRef.current;
    const timer = window.setTimeout(() => {
      void lookupAdminUser(trimmed).then((outcome) => {
        if (lookupRequestRef.current !== requestId) return;

        if (outcome.status === "invalid") {
          setMatchedUser(null);
          setLookupStatus("idle");
          return;
        }

        if (outcome.status === "error") {
          setMatchedUser(null);
          setLookupStatus("error");
          setLookupMessage(outcome.message);
          return;
        }

        if (outcome.status === "new") {
          setMatchedUser(null);
          setLookupStatus("new");
          setLookupMessage("New account — they'll get an email to set their password.");
          if (!nameEditedRef.current && !fullName.trim()) {
            const suggested = trimmed.split("@")[0]?.replace(/[._-]+/g, " ").trim();
            if (suggested) {
              setFullName(suggested.replace(/\b\w/g, (char) => char.toUpperCase()));
            }
          }
          return;
        }

        setMatchedUser(outcome.user);
        setLookupStatus("found");
        setLookupMessage(`Existing account — ${outcome.user.displayName} will get Admin access.`);
        if (!nameEditedRef.current) {
          setFullName(outcome.user.displayName);
        }
      });
    }, 400);

    return () => window.clearTimeout(timer);
  }, [email]);

  function submit() {
    startSubmit(async () => {
      setError(null);
      const trimmedEmail = email.trim();
      const trimmedName = fullName.trim();

      if (!EMAIL_PATTERN.test(trimmedEmail)) {
        setError("Enter a valid email address.");
        return;
      }

      if (!trimmedName) {
        setError("Enter the admin's full name.");
        return;
      }

      if (matchedUser?.adminStatus === "active") {
        setError("This user is already an active Academy Admin.");
        return;
      }

      if (matchedUser?.conflictRole === "instructor") {
        setError(
          "This account is already an Instructor. Revoke Instructor on the Instructors page first — one email can only hold one Academy role.",
        );
        return;
      }

      if (matchedUser?.conflictRole === "super_admin") {
        setError("This account is already the Academy Super Admin. Use a different email for Admin.");
        return;
      }

      const result = await inviteAcademyAdminAction({
        email: trimmedEmail,
        displayName: trimmedName,
      });

      if (!result.ok) {
        setError(result.message || "The admin could not be added.");
        return;
      }

      onGranted({
        displayName: result.displayName,
        email: result.email,
        mode: result.mode,
        emailSent: result.emailSent,
        message: result.message,
      });
    });
  }

  const canSubmit =
    !submitPending &&
    lookupStatus !== "checking" &&
    (lookupStatus === "found" || lookupStatus === "new") &&
    EMAIL_PATTERN.test(email.trim()) &&
    fullName.trim().length > 0 &&
    matchedUser?.adminStatus !== "active" &&
    matchedUser?.conflictRole !== "instructor" &&
    matchedUser?.conflictRole !== "super_admin";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[520px] rounded-[12px] bg-surface p-6 shadow-lg"
        style={{ border: "1px solid var(--border)" }}
        onClick={(event) => event.stopPropagation()}
      >
        <h2 className="text-[18px] font-semibold tracking-[-0.2px]" style={{ color: "var(--ink)" }}>
          Add admin
        </h2>
        <p className="mt-2 text-[13.5px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
          Academy Admins are added by the Super Admin — there is no self-service Admin sign-up.
          Existing users get Admin access immediately. New emails receive a setup link that expires
          in 24 hours.
        </p>

        <div className="mt-5 space-y-4">
          <div>
            <Input
              label="Email address"
              name="email"
              type="email"
              value={email}
              placeholder="name@privateattache.com"
              autoComplete="off"
              disabled={submitPending}
              onChange={(event) => {
                setEmail(event.target.value);
                setError(null);
              }}
            />
            {lookupStatus === "checking" ? (
              <p className="mt-1.5 text-[12.5px]" style={{ color: "var(--text-tertiary)" }}>
                Checking email…
              </p>
            ) : null}
            {lookupStatus === "found" && lookupMessage ? (
              <p className="mt-1.5 text-[12.5px]" style={{ color: "var(--success-fg)" }}>
                {lookupMessage}
              </p>
            ) : null}
            {lookupStatus === "new" && lookupMessage ? (
              <p className="mt-1.5 text-[12.5px]" style={{ color: "var(--accent)" }}>
                {lookupMessage}
              </p>
            ) : null}
            {lookupStatus === "error" && lookupMessage ? (
              <p className="mt-1.5 text-[12.5px]" style={{ color: "var(--danger-fg)" }}>
                {lookupMessage}
              </p>
            ) : null}
            {lookupStatus === "idle" && lookupMessage ? (
              <p className="mt-1.5 text-[12.5px]" style={{ color: "var(--text-tertiary)" }}>
                {lookupMessage}
              </p>
            ) : null}
          </div>
          <Input
            label="Full name"
            name="fullName"
            value={fullName}
            placeholder="Admin's name"
            disabled={submitPending}
            onChange={(event) => {
              nameEditedRef.current = true;
              setFullName(event.target.value);
            }}
          />
        </div>

        {matchedUser?.adminStatus === "suspended" ? (
          <p className="mt-3 text-[13px]" style={{ color: "var(--warning-fg)" }}>
            This user was previously an Admin. Saving will reactivate their role.
          </p>
        ) : null}

        {matchedUser?.adminStatus === "active" ? (
          <p className="mt-3 text-[13px]" style={{ color: "var(--danger-fg)" }}>
            This user is already an active Academy Admin.
          </p>
        ) : null}

        {matchedUser?.conflictRole === "learner" ? (
          <p className="mt-3 text-[13px]" style={{ color: "var(--text-secondary)" }}>
            This account is currently a Learner. Granting Admin will replace Learner on this email.
          </p>
        ) : null}

        {matchedUser?.conflictRole === "instructor" ? (
          <p className="mt-3 text-[13px]" style={{ color: "var(--danger-fg)" }}>
            This account is already an Instructor. Revoke Instructor on the Instructors page first.
          </p>
        ) : null}

        {matchedUser?.conflictRole === "super_admin" ? (
          <p className="mt-3 text-[13px]" style={{ color: "var(--danger-fg)" }}>
            This account is already the Academy Super Admin. Use a different email for Admin.
          </p>
        ) : null}

        {error ? (
          <p className="mt-3 text-[13px]" style={{ color: "var(--danger-fg)" }}>
            {error}
          </p>
        ) : null}

        <div className="mt-6 flex justify-end gap-2">
          <Button variant="secondary" disabled={submitPending} onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" disabled={!canSubmit} onClick={submit}>
            {submitPending
              ? lookupStatus === "new"
                ? "Sending…"
                : "Adding…"
              : lookupStatus === "new"
                ? "Send invite"
                : matchedUser?.adminStatus === "suspended"
                  ? "Reactivate admin"
                  : "Add admin"}
          </Button>
        </div>
      </div>
    </div>
  );
}
