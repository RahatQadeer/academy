"use client";

import { updateClientStatus } from "@/whitbyos/clients/actions";

const OPTIONS = [
  { value: "active", label: "Active" },
  { value: "at_risk", label: "At risk" },
  { value: "inactive", label: "Inactive" },
];

/** The same tones StatusPill gives these three words, so a client's health is
    one colour wherever it is read. */
const TONES: Record<string, { background: string; color: string }> = {
  active: { background: "var(--success-bg)", color: "var(--success-fg)" },
  at_risk: { background: "var(--danger-bg)", color: "var(--danger-text)" },
  inactive: { background: "var(--surface-active)", color: "var(--text-secondary)" },
};

/**
 * Screen 2.1 Profile — changing health updates the Clients list Status column.
 *
 * It reads as the pill it is everywhere else in the product, not as a form
 * control: on a row of facts — Classification, Status, Owner — a bordered
 * select with a chevron was the only thing shouting, and what it mostly says
 * is "Active", which is a fact rather than a question. The chevron appears
 * when the pointer is on it, which is when somebody is about to change it.
 */
export function ClientStatusField({
  clientId,
  value,
}: {
  clientId: string;
  value: string;
}) {
  const tone = TONES[value] ?? TONES.inactive;

  return (
    <form action={updateClientStatus} className="group relative inline-flex items-center">
      <input type="hidden" name="client_id" value={clientId} />
      <select
        name="status"
        defaultValue={value}
        aria-label="Client status"
        onChange={(event) => event.currentTarget.form?.requestSubmit()}
        className="cursor-pointer appearance-none rounded-full border border-transparent py-[3px] pl-2.5 pr-2.5 text-[12px] font-medium transition-all group-hover:border-[var(--border-strong)] group-hover:pr-[22px] focus:border-[var(--border-strong)] focus:pr-[22px] focus:outline-none"
        style={tone}
      >
        {OPTIONS.map((option) => (
          <option key={option.value} value={option.value} style={{ color: "var(--ink)" }}>
            {option.label}
          </option>
        ))}
      </select>

      {/* Only while it is being reached for. */}
      <span
        aria-hidden
        className="pointer-events-none absolute right-2 text-[9px] opacity-0 transition-opacity group-hover:opacity-70 group-focus-within:opacity-70"
        style={{ color: tone.color }}
      >
        {"\u25be"}
      </span>
    </form>
  );
}
