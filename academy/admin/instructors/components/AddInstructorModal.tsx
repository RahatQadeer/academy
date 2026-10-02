"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Button } from "@/base/components/Button";
import { Input } from "@/base/components/Input";
import { programStatusLabel } from "@/academy/instructor/utils/labels";
import {
  grantInstructorWithAssignmentsAction,
  searchUsersForInstructorGrantAction,
} from "../actions";
import type { InstructorGrantCandidate, InstructorProgramOption } from "../types";
import { USER_SEARCH_MIN } from "../types";

type LookupStatus = "idle" | "checking" | "found" | "new" | "error";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function lookupInstructorUser(
  query: string,
): Promise<
  | { status: "found"; user: InstructorGrantCandidate }
  | { status: "new" }
  | { status: "invalid" }
  | { status: "error"; message: string }
> {
  const trimmed = query.trim();
  if (trimmed.length < USER_SEARCH_MIN) {
    return { status: "invalid" };
  }

  const result = await searchUsersForInstructorGrantAction(trimmed);
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

export function AddInstructorModal({
  programs,
  onClose,
  onSent,
}: {
  programs: InstructorProgramOption[];
  onClose: () => void;
  onSent: (sent: {
    displayName: string;
    email: string;
    mode: "existing" | "invited";
    userId: string | null;
    programNames: string[];
  }) => void;
}) {
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [selectedProgramIds, setSelectedProgramIds] = useState<string[]>([]);
  const [matchedUser, setMatchedUser] = useState<InstructorGrantCandidate | null>(null);
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
      setLookupStatus(trimmed.length === 0 ? "idle" : "idle");
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
      void lookupInstructorUser(trimmed).then((outcome) => {
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
        setLookupMessage(`Existing account — ${outcome.user.displayName} will get instructor access.`);
        if (!nameEditedRef.current) {
          setFullName(outcome.user.displayName);
        }
      });
    }, 400);

    return () => window.clearTimeout(timer);
  }, [email]);

  function toggleProgram(programId: string) {
    setSelectedProgramIds((current) =>
      current.includes(programId)
        ? current.filter((id) => id !== programId)
        : [...current, programId],
    );
  }

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
        setError("Enter the instructor's full name.");
        return;
      }

      if (matchedUser?.instructorStatus === "active") {
        setError("This user is already an active Instructor.");
        return;
      }

      if (matchedUser?.conflictRole === "learner") {
        setError(
          "This account is already a Learner. Remove the Learner role first — one email can only hold one Academy role.",
        );
        return;
      }

      if (matchedUser?.conflictRole === "admin" || matchedUser?.conflictRole === "super_admin") {
        setError(
          matchedUser.conflictRole === "super_admin"
            ? "This account is already an Academy Super Admin. Revoke Super Admin first — one email can only hold one Academy role."
            : "This account is already an Academy Admin. Revoke Admin first — one email can only hold one Academy role.",
        );
        return;
      }

      const result = await grantInstructorWithAssignmentsAction({
        email: trimmedEmail,
        displayName: trimmedName,
        programIds: selectedProgramIds,
      });

      if (!result.ok) {
        setError(result.message || "The instructor could not be added.");
        return;
      }

      onSent({
        displayName: result.displayName,
        email: result.email,
        mode: result.mode === "existing" ? "existing" : "invited",
        userId: result.userId,
        programNames: result.programNames,
      });
    });
  }

  const canSubmit =
    !submitPending &&
    lookupStatus !== "checking" &&
    EMAIL_PATTERN.test(email.trim()) &&
    fullName.trim().length > 0 &&
    matchedUser?.instructorStatus !== "active" &&
    !matchedUser?.conflictRole;

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
          Add instructor
        </h2>
        <p className="mt-2 text-[13.5px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
          Instructor accounts are added manually by an Admin — there is no self-service instructor
          sign-up. Existing users get instructor access immediately. New emails receive a setup
          link that expires in 24 hours.
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
          </div>
          <Input
            label="Full name"
            name="fullName"
            value={fullName}
            placeholder="Instructor's name"
            disabled={submitPending}
            onChange={(event) => {
              nameEditedRef.current = true;
              setFullName(event.target.value);
            }}
          />
          <label className="block">
            <span
              className="mb-1.5 block text-[12.5px] font-medium uppercase tracking-[0.05em]"
              style={{ color: "var(--text-tertiary)" }}
            >
              Assigned programs
            </span>
            <p className="mb-2 text-[12.5px]" style={{ color: "var(--text-tertiary)" }}>
              Each checked program is full access. Limit to modules later from Edit scope.
            </p>
            <div
              className="max-h-[180px] overflow-y-auto rounded-[8px] p-2"
              style={{ border: "1px solid var(--border-strong)" }}
            >
              {programs.length === 0 ? (
                <p className="px-2 py-3 text-[13px]" style={{ color: "var(--text-secondary)" }}>
                  No programs in the catalog yet.
                </p>
              ) : (
                <ul className="space-y-1">
                  {programs.map((program) => {
                    const checked = selectedProgramIds.includes(program.id);
                    return (
                      <li key={program.id}>
                        <label className="flex cursor-pointer items-start gap-2 rounded-[6px] px-2 py-2 hover:bg-[var(--surface-soft)]">
                          <input
                            type="checkbox"
                            className="mt-0.5"
                            checked={checked}
                            disabled={submitPending}
                            onChange={() => toggleProgram(program.id)}
                          />
                          <span className="min-w-0">
                            <span className="block text-[13.5px]">{program.name}</span>
                            <span className="text-[12px]" style={{ color: "var(--text-tertiary)" }}>
                              {programStatusLabel(program.status)}
                            </span>
                          </span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </label>
        </div>

        <p className="mt-4 text-[12.5px] leading-relaxed" style={{ color: "var(--text-tertiary)" }}>
          Access is limited strictly to what&apos;s assigned here — this instructor can&apos;t create
          new programs or publish directly.
        </p>

        {matchedUser?.instructorStatus === "suspended" ? (
          <p className="mt-3 text-[13px]" style={{ color: "var(--warning-fg)" }}>
            This user was previously an Instructor. Saving will reactivate their role.
          </p>
        ) : null}

        {matchedUser?.instructorStatus === "active" ? (
          <p className="mt-3 text-[13px]" style={{ color: "var(--danger-fg)" }}>
            This user is already an active Instructor.
          </p>
        ) : null}

        {matchedUser?.conflictRole === "learner" ? (
          <p className="mt-3 text-[13px]" style={{ color: "var(--danger-fg)" }}>
            This account is already a Learner. Remove Learner first — one email, one Academy role.
          </p>
        ) : null}

        {matchedUser?.conflictRole === "admin" || matchedUser?.conflictRole === "super_admin" ? (
          <p className="mt-3 text-[13px]" style={{ color: "var(--danger-fg)" }}>
            {matchedUser.conflictRole === "super_admin"
              ? "This account is already an Academy Super Admin. Revoke Super Admin first — one email, one Academy role."
              : "This account is already an Academy Admin. Revoke Admin first — one email, one Academy role."}
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
            {submitPending ? "Sending…" : "Send invite"}
          </Button>
        </div>
      </div>
    </div>
  );
}
