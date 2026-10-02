import Link from "next/link";
import { Pill } from "@/base/components/Pill";
import { SectionTitle } from "@/whitbyos/components/EmptyNote";
import type { PortalCeiling } from "@/whitbyos/lib/client-sections";
import type { ClientBilling } from "@/whitbyos/lib/invoices";
import { money } from "@/whitbyos/lib/format";

/**
 * SRS §5.3.3 section 5 — Account: Client Portal access, billing and engagement
 * context, and the assigned team.
 *
 * The portal ceiling is §5.3.4's rule in practice: the maximum this client's
 * portal account can ever hold, with everything the client side does
 * afterwards sitting inside it. It is reported here and set nowhere in Whitby
 * — supabase/00056 moved both numbers onto the workspace, where Private
 * Attaché staff set one figure for every client, and a trigger refuses a write
 * from anywhere else.
 */
export function AccountSection({
  ceiling,
  ownerName,
  billing,
  billingHref,
}: {
  ceiling: PortalCeiling;
  ownerName: string;
  /** This client's invoices, summed by the same function the Billing tab uses. */
  billing: ClientBilling;
  billingHref: string;
}) {
  return (
    <>
      <SectionTitle>Client Portal access</SectionTitle>
      <div
        className="mb-5 overflow-hidden rounded-[12px] border"
        style={{
          borderColor: "color-mix(in srgb, var(--chrome-line) 85%, #c5ced8)",
          background: "var(--surface)",
          boxShadow: "0 1px 2px rgba(31,72,125,.04)",
        }}
      >
        <Row label="Portal enabled">
          {ceiling.anyPortalAccess ? (
            <Pill tone="success">On</Pill>
          ) : (
            <Pill tone="neutral">Off</Pill>
          )}
        </Row>
        <Row label="People with access">
          {ceiling.membersWithAccess}
        </Row>
        {/* "No limit" rather than "Not set": a blank column is a decision the
            portal already acts on, not a field nobody has reached yet. */}
        <Row label="Maximum additional members">
          {ceiling.maxAdditionalMembers ?? "No limit"}
        </Row>
        <Row label="Maximum authorized users">
          {ceiling.maxAuthorizedUsers ?? "No limit"}
        </Row>
      </div>
      <p className="-mt-3 mb-5 text-[12px]" style={{ color: "var(--text-tertiary)" }}>
        These limits apply to every client in your workspace and are set by
        Private Attaché. Contact them to have them raised.
      </p>

      <SectionTitle>Assigned team</SectionTitle>
      <div
        className="mb-5 overflow-hidden rounded-[12px] border"
        style={{
          borderColor: "color-mix(in srgb, var(--chrome-line) 85%, #c5ced8)",
          background: "var(--surface)",
          boxShadow: "0 1px 2px rgba(31,72,125,.04)",
        }}
      >
        <Row label="Owner">{ownerName}</Row>
      </div>

      {/*
        This said "Billing is not connected yet. Once an accounting integration
        is set up, this client's engagement and invoices will appear here." None
        of it had been true since migration 059 — invoices are a table in this
        schema, the Billing tab raises and sends them, and 067 wired Stripe to
        collect them. It was written before any of that existed, was gated on
        nothing, and so told professionals with sent and paid invoices that they
        had no billing.
      */}
      <div className="flex items-baseline justify-between gap-3">
        <SectionTitle>Billing and engagement</SectionTitle>
        <Link
          href={billingHref}
          className="text-[12.5px] font-medium no-underline"
          style={{ color: "var(--accent)" }}
        >
          {billing.count > 0 ? "All invoices" : "New invoice"}
        </Link>
      </div>

      {billing.count === 0 ? (
        <div
          className="rounded-[12px] border px-3.5 py-3"
          style={{
            borderColor: "color-mix(in srgb, var(--chrome-line) 85%, #c5ced8)",
            background: "var(--surface)",
          }}
        >
          <p className="text-[13px]" style={{ margin: 0, color: "var(--text-secondary)" }}>
            No invoices for this client yet. A new one saves as a draft, and
            nobody on the account sees it until you send it.
          </p>
        </div>
      ) : (
        <div
          className="overflow-hidden rounded-[12px] border"
          style={{
            borderColor: "color-mix(in srgb, var(--chrome-line) 85%, #c5ced8)",
            background: "var(--surface)",
            boxShadow: "0 1px 2px rgba(31,72,125,.04)",
          }}
        >
          <Row label="Outstanding">
            {money(billing.outstandingCents, billing.currency)}
            {billing.overdueCount > 0 ? (
              <span className="ml-2">
                <Pill tone="danger">
                  {billing.overdueCount} overdue
                </Pill>
              </span>
            ) : null}
          </Row>
          <Row label="Paid this year">
            {money(billing.paidThisYearCents, billing.currency)}
          </Row>
          <Row label="Invoices">
            {billing.count}
            {billing.draftCount > 0 ? (
              <span className="ml-2">
                <Pill tone="neutral">
                  {billing.draftCount} draft{billing.draftCount === 1 ? "" : "s"}
                </Pill>
              </span>
            ) : null}
          </Row>
        </div>
      )}
    </>
  );
}

/** Stacked rather than side by side: this now sits in Overview's 280px column. */
function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 border-b border-line px-3.5 py-2.5 last:border-b-0">
      <span className="text-[12.5px]" style={{ color: "var(--text-tertiary)" }}>
        {label}
      </span>
      <span className="text-[13px] font-medium">{children}</span>
    </div>
  );
}
