"use client";

import { Avatar } from "@/base/components/Avatar";
import { Button } from "@/base/components/Button";
import { Pill } from "@/base/components/Pill";
import { Surface } from "@/academy/components/ui";

export type InviteSentDetails = {
  displayName: string;
  email: string;
  mode: "existing" | "invited";
  userId: string | null;
  programNames: string[];
};

function MailCheckIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 7.5h16v10.2A1.8 1.8 0 0 1 18.2 19.5H5.8A1.8 1.8 0 0 1 4 17.7V7.5z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path
        d="M4 7.5 12 13l8-5.5"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M3.5 8.4 6.4 11.2 12.5 4.8"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function InviteSentView({
  sent,
  onDone,
  onAddAnother,
}: {
  sent: InviteSentDetails;
  onDone: () => void;
  onAddAnother: () => void;
}) {
  const existing = sent.mode === "existing";
  const steps = existing
    ? [
        "They already have a Private Attaché account — no new login to create.",
        "We emailed them that Instructor access is now active.",
        sent.programNames.length > 0
          ? "They can edit only the programs you assigned. Publishing still needs your approval."
          : "No programs were assigned. You can add scope from their instructor record.",
      ]
    : [
        "They’ll receive an email with a link to set a password and join Academy. The link expires in 24 hours.",
        "If they miss it, resend the invite from the Instructors list — that issues a new 24-hour link.",
        "Instructor access is granted after they accept the invite.",
        sent.programNames.length > 0
          ? "Once they join, they can edit only the programs you assigned."
          : "You can assign programs after they accept the invite.",
      ];

  return (
    <div className="mx-auto w-full max-w-[640px]">
      <Surface elevated className="overflow-hidden">
        <div
          className="flex items-start gap-3.5 border-b px-5 py-5 sm:px-6"
          style={{
            borderColor: "var(--border)",
            background: "linear-gradient(180deg, var(--success-bg) 0%, #ffffff 100%)",
          }}
        >
          <span
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px]"
            style={{ background: "var(--success-bg)", color: "var(--success-fg)" }}
            aria-hidden
          >
            <MailCheckIcon />
          </span>
          <div className="min-w-0 pt-0.5">
            <p
              className="text-[11.5px] font-semibold uppercase tracking-[0.06em]"
              style={{ color: "var(--success-fg)" }}
            >
              {existing ? "Access granted" : "Invite sent"}
            </p>
            <h1 className="mt-1 text-[22px] font-bold tracking-[-0.4px] text-pretty">
              {existing ? `${sent.displayName} is now an Instructor` : `Invite sent to ${sent.displayName}`}
            </h1>
            <p className="mt-1.5 text-[13.5px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
              {existing
                ? "They can open Academy with their existing account. Scope is limited to what you assigned."
                : "They’ll set a password from the email, then land in Academy as an Instructor."}
            </p>
          </div>
        </div>

        <div className="px-5 py-5 sm:px-6">
          <div className="flex items-center gap-3.5">
            <Avatar name={sent.displayName} size={44} tone="tan" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[15px] font-semibold tracking-[-0.15px]">{sent.displayName}</p>
              <p className="truncate text-[13px]" style={{ color: "var(--text-secondary)" }}>
                {sent.email}
              </p>
            </div>
            <Pill tone={existing ? "success" : "info"}>
              {existing ? "Existing account" : "Pending invite"}
            </Pill>
          </div>

          <div className="mt-5 border-t pt-5" style={{ borderColor: "var(--border)" }}>
            <p
              className="mb-2 text-[11.5px] font-semibold uppercase tracking-[0.06em]"
              style={{ color: "var(--text-tertiary)" }}
            >
              Assigned programs
            </p>
            {sent.programNames.length === 0 ? (
              <p className="text-[13.5px]" style={{ color: "var(--text-secondary)" }}>
                None yet — assign programs from their instructor record when you’re ready.
              </p>
            ) : (
              <ul className="m-0 flex list-none flex-wrap gap-1.5 p-0">
                {sent.programNames.map((name) => (
                  <li
                    key={name}
                    className="inline-flex max-w-full truncate rounded-[7px] px-2.5 py-1 text-[12.5px] font-medium"
                    style={{
                      background: "var(--accent-tint-mid)",
                      color: "var(--ink)",
                      boxShadow: "inset 0 0 0 1px var(--border)",
                    }}
                  >
                    {name}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="mt-5 border-t pt-5" style={{ borderColor: "var(--border)" }}>
            <p
              className="mb-3 text-[11.5px] font-semibold uppercase tracking-[0.06em]"
              style={{ color: "var(--text-tertiary)" }}
            >
              What happens next
            </p>
            <ol className="m-0 list-none space-y-2.5 p-0">
              {steps.map((step) => (
                <li key={step} className="flex items-start gap-2.5">
                  <span
                    className="mt-[1px] inline-flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full"
                    style={{ background: "var(--success-bg)", color: "var(--success-fg)" }}
                    aria-hidden
                  >
                    <CheckIcon />
                  </span>
                  <p className="text-[13.5px] leading-relaxed text-pretty" style={{ color: "var(--text-secondary)" }}>
                    {step}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        </div>

        <div
          className="flex flex-col-reverse gap-2 border-t px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6"
          style={{ borderColor: "var(--border)", background: "var(--surface-subtle)" }}
        >
          <Button variant="ghost" onClick={onAddAnother}>
            Add another
          </Button>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center">
            {sent.userId ? (
              <Button variant="secondary" href={`/academy/admin/instructors/${sent.userId}`}>
                Open instructor
              </Button>
            ) : null}
            <Button variant="primary" onClick={onDone}>
              Back to Instructors
            </Button>
          </div>
        </div>
      </Surface>
    </div>
  );
}
