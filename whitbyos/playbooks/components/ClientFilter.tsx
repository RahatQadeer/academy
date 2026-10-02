"use client";

import { SubmitPlain } from "@/base/components/Submit";

/**
 * v2's "Used in any Workspace" select.
 *
 * A client component for one reason: choosing is the whole interaction, so the
 * form submits on change rather than making anyone press a second control.
 * Without script it falls back to the Apply button beside it, which is why the
 * form is a real form with a real action rather than a router push.
 */
export function ClientFilter({
  tab,
  action,
  value,
  options,
}: {
  tab: string;
  action: string;
  value: string;
  options: Array<{ id: string; name: string }>;
}) {
  return (
    <form action={action} className="mb-4 flex gap-2.5">
      {tab ? <input type="hidden" name="tab" value={tab} /> : null}
      <select
        name="client"
        defaultValue={value}
        aria-label="Filter by workspace"
        onChange={(event) => event.currentTarget.form?.requestSubmit()}
        className="cursor-pointer rounded-control border border-line-strong bg-surface px-3 py-2 text-[13.5px]"
        style={{ color: "var(--ink)" }}
      >
        <option value="">Used in any Workspace</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.name}
          </option>
        ))}
      </select>
      <noscript>
        <SubmitPlain
         
          className="rounded-control border border-line-strong px-3 text-[13px]"
        >
          Apply
        </SubmitPlain>
      </noscript>
    </form>
  );
}
