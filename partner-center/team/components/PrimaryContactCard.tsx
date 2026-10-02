import { Pill } from "@/base/components/Pill";
import { functionLabel } from "@/partner-center/team/lib/labels";
import type { PrimaryContactSummary } from "@/partner-center/team/types";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div
        className="text-[12.5px] font-medium uppercase tracking-[0.04em]"
        style={{ color: "var(--text-tertiary)" }}
      >
        {label}
      </div>
      <div className="mt-1 text-[14px] leading-snug" style={{ color: "var(--ink)" }}>
        {children}
      </div>
    </div>
  );
}

export function PrimaryContactCard({
  primaryContact,
}: {
  primaryContact: PrimaryContactSummary;
}) {
  return (
    <section className="mt-5">
      <h2
        className="mb-2.5 mt-0 text-[14px] font-semibold"
        style={{ color: "var(--ink)" }}
      >
        Primary relationship
      </h2>
      <div className="pa-partner-card p-5">
        {!primaryContact ? (
          <p className="m-0 text-[13.5px]" style={{ color: "var(--text-secondary)" }}>
            No primary contact is set yet.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
            <Field label="Name">{primaryContact.name}</Field>
            <Field label="Email">{primaryContact.email}</Field>
            <Field label="Phone">{primaryContact.phone || "—"}</Field>
            <Field label="Role">{primaryContact.roleTitle}</Field>
            <Field label="Contact function">
              {primaryContact.function ? (
                <Pill tone="accent">{functionLabel(String(primaryContact.function))}</Pill>
              ) : (
                "—"
              )}
            </Field>
          </div>
        )}
      </div>
    </section>
  );
}
