"use client";

import { useState } from "react";
import { ONBOARDING_CONTROL } from "@/whitbyos/onboarding/components/OnboardingShell";

/** Roles offered at invite time. Detail is deferred to People & Access (§4.4.4). */
const ROLES = [
  { value: "admin", label: "Admin" },
  { value: "team_lead", label: "Team Lead" },
  { value: "coordinator", label: "Coordinator" },
  { value: "billing", label: "Billing" },
  { value: "viewer", label: "Viewer" },
];

const ROW = "grid grid-cols-[minmax(0,1fr)_158px_28px] items-center gap-2";

export function InviteRows() {
  const [rows, setRows] = useState([0]);
  const [nextId, setNextId] = useState(1);

  return (
    <div className="flex flex-col gap-2">
      <div
        className={`${ROW} px-0.5 text-[11.5px] font-semibold uppercase tracking-[0.04em]`}
        style={{ color: "var(--text-tertiary)" }}
      >
        <span>Email</span>
        <span>Role</span>
        <span aria-hidden />
      </div>

      <div className="flex max-h-[min(260px,34vh)] flex-col gap-2 overflow-y-auto">
        {rows.map((id, index) => (
          <div key={id} className={ROW}>
            <input
              name="email"
              type="email"
              placeholder="Enter email"
              aria-label={`Invitee ${index + 1} email`}
              className={ONBOARDING_CONTROL}
            />
            <select
              name="role"
              defaultValue="coordinator"
              aria-label={`Invitee ${index + 1} role`}
              className={`${ONBOARDING_CONTROL} text-[13.5px]`}
            >
              {ROLES.map((role) => (
                <option key={role.value} value={role.value}>
                  {role.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setRows((current) => current.filter((r) => r !== id))}
              disabled={rows.length === 1}
              aria-label={`Remove invitee ${index + 1}`}
              className="flex h-8 w-8 items-center justify-center rounded-full transition-colors hover:bg-[var(--canvas)] disabled:pointer-events-none disabled:opacity-30"
              style={{ color: "var(--text-tertiary)" }}
            >
              <CloseGlyph />
            </button>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={() => {
          setRows((current) => [...current, nextId]);
          setNextId((n) => n + 1);
        }}
        className="mt-0.5 self-start text-[13px] font-semibold"
        style={{ color: "var(--accent)" }}
      >
        + Add another
      </button>
    </div>
  );
}

function CloseGlyph() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
      <path
        d="M2.5 2.5 9.5 9.5M9.5 2.5 2.5 9.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}
