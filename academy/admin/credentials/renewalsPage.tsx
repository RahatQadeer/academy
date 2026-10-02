import { Suspense } from "react";
import Link from "next/link";
import { Callout } from "@/base/components/Callout";
import { Pill } from "@/base/components/Pill";
import { PageHeader, PageShell, Surface } from "@/academy/components/ui";
import { formatCredentialDate } from "./lib/format";
import { loadAdminRenewalList, type AdminRenewalListItem } from "./services/loadAdminRenewals";

async function RenewalsBody() {
  const result = await loadAdminRenewalList();
  if (!result.ok) {
    return (
      <PageShell>
        <Callout tone="warning" title="Admin access required">
          Certificate renewals are limited to Academy Admins.
        </Callout>
      </PageShell>
    );
  }

  const open = result.items.filter((item) =>
    [
      "pending_admin",
      "awaiting_form",
      "awaiting_payment",
      "awaiting_form_and_payment",
      "under_review",
    ].includes(item.status),
  );
  const closed = result.items.filter((item) => !open.includes(item));

  return (
    <PageShell>
      <PageHeader
        className="mb-5"
        eyebrow="Certificates & Credentials"
        title="Renewal requests"
        description="When a learner requests renewal on an awarded certificate with a term, it appears here. Open a request and choose one path."
        actions={
          <Link
            href="/academy/admin/credentials"
            className="rounded-[8px] border border-line bg-surface px-3 py-2 text-[13px] font-medium text-ink no-underline hover:bg-surface-soft"
          >
            ← All certificates
          </Link>
        }
      />

      <Surface elevated className="mb-5 overflow-hidden">
        <div className="border-b border-line px-5 py-3.5">
          <p
            className="text-[11.5px] font-semibold uppercase tracking-[0.06em]"
            style={{ color: "var(--text-tertiary)" }}
          >
            Your three renewal paths
          </p>
        </div>
        <ol className="grid gap-0 sm:grid-cols-3">
          <PathCard
            n="1"
            title="Approve directly"
            body="Renew now. Extends expiration three years. Same Certificate ID."
          />
          <PathCard
            n="2"
            title="Request information"
            body="Build a form for the learner. Review their answers, then approve or deny."
          />
          <PathCard
            n="3"
            title="Payment (± form)"
            body="Charge the program fee only, or fee plus a form. Payment-only renews automatically."
            last
          />
        </ol>
      </Surface>

      <RenewalSection
        title="Needs attention"
        items={open}
        empty="No open renewal requests. Learners start from their certificate → Renew certificate."
      />
      <RenewalSection
        title="Recent decisions"
        items={closed.slice(0, 20)}
        empty="No closed renewals yet."
      />
    </PageShell>
  );
}

function PathCard({
  n,
  title,
  body,
  last,
}: {
  n: string;
  title: string;
  body: string;
  last?: boolean;
}) {
  return (
    <li
      className={`px-5 py-4 ${last ? "" : "border-b border-line sm:border-b-0 sm:border-r"}`}
    >
      <span
        className="mb-2 inline-flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold tabular-nums"
        style={{
          background: "color-mix(in srgb, var(--module-academy-fg) 12%, white)",
          color: "var(--module-academy-fg)",
        }}
      >
        {n}
      </span>
      <p className="text-[13px] font-semibold text-ink">{title}</p>
      <p className="mt-0.5 text-[12.5px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
        {body}
      </p>
    </li>
  );
}

function RenewalSection({
  title,
  items,
  empty,
}: {
  title: string;
  items: AdminRenewalListItem[];
  empty: string;
}) {
  return (
    <section className="mt-6">
      <div className="mb-3 flex items-center gap-2">
        <h2
          className="text-[12px] font-semibold uppercase tracking-[0.06em]"
          style={{ color: "var(--text-tertiary)" }}
        >
          {title}
        </h2>
        <span
          className="rounded-[4px] px-1.5 py-0.5 text-[11px] font-medium tabular-nums"
          style={{ background: "var(--canvas)", color: "var(--text-secondary)" }}
        >
          {items.length}
        </span>
      </div>
      {items.length === 0 ? (
        <Surface padded>
          <p className="text-[13.5px]" style={{ color: "var(--text-secondary)" }}>
            {empty}
          </p>
        </Surface>
      ) : (
        <ul className="overflow-hidden rounded-[12px] border border-line bg-surface divide-y divide-[var(--border)]">
          {items.map((item) => (
            <li key={item.id}>
              <Link
                href={`/academy/admin/credentials/renewals/${item.id}`}
                className="flex flex-col gap-1 px-4 py-3.5 no-underline transition-colors hover:bg-[var(--surface-soft)] sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="truncate text-[14.5px] font-semibold text-ink">{item.programName}</p>
                  <p className="mt-0.5 text-[12.5px]" style={{ color: "var(--text-secondary)" }}>
                    {item.learnerName}
                    {item.publicId ? ` · ${item.publicId}` : ""}
                    {item.expiresAt ? ` · expires ${formatCredentialDate(item.expiresAt)}` : ""}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <Pill tone="accent">{item.statusLabel}</Pill>
                  {item.formRequired ? <Pill tone="neutral">Form</Pill> : null}
                  {item.paymentRequired ? <Pill tone="neutral">Payment</Pill> : null}
                  <span className="text-[12.5px] font-medium" style={{ color: "var(--accent)" }}>
                    Open →
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function AdminRenewalsPage() {
  return (
    <Suspense
      fallback={
        <PageShell>
          <p className="text-[13px]" style={{ color: "var(--text-tertiary)" }}>
            Loading renewals…
          </p>
        </PageShell>
      }
    >
      <RenewalsBody />
    </Suspense>
  );
}
