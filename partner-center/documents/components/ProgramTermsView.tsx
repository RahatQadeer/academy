import Link from "next/link";
import { PartnerChrome } from "@/partner-center/components/PartnerChrome";
import type { ProgramTermsDetail } from "@/partner-center/documents/types";
import { documentsListHref } from "@/partner-center/documents/types";

/** F48 Program Terms summary — layout from Partner Center HTML reference. */
export function ProgramTermsView({ data }: { data: ProgramTermsDetail }) {
  const rows = [
    { label: "Eligible earning period", value: data.eligiblePeriodLabel },
    { label: "Cookie / tracking rule", value: data.cookieRuleLabel },
    { label: "Eligible revenue", value: data.eligibleRevenueLabel },
    { label: "Excluded revenue", value: data.excludedRevenueLabel },
    { label: "Payment terms", value: data.paymentTermsLabel },
    { label: "Refunds & chargebacks", value: data.refundsLabel },
  ];

  return (
    <div className="flex min-h-full flex-col px-5 py-6 sm:px-6 lg:px-8 xl:px-12">
      <PartnerChrome
        title={data.programTitle}
        subtitle={data.governedByLabel}
      />
      <Link
        href="/partner-center/documents"
        className="mb-4 inline-block text-[13px] font-semibold no-underline"
        style={{ color: "var(--accent)" }}
      >
        ← Back to Documents
      </Link>

      {data.activePrograms.length > 1 ? (
        <div className="mb-5 flex flex-wrap gap-2">
          {data.activePrograms.map((program) => {
            const active = program.value === data.program;
            return (
              <Link
                key={program.value}
                href={`/partner-center/documents/terms?program=${program.value}`}
                className="rounded-md px-3 py-1.5 text-[13px] no-underline"
                style={{
                  border: active
                    ? "1.5px solid var(--accent)"
                    : "1px solid var(--border)",
                  background: active
                    ? "var(--accent-tint-mid)"
                    : "var(--surface)",
                  color: active
                    ? "var(--accent-hover)"
                    : "var(--text-secondary)",
                  fontWeight: active ? 500 : 400,
                }}
              >
                {program.label}
              </Link>
            );
          })}
        </div>
      ) : null}

      <div className="grid max-w-[1000px] gap-5 sm:grid-cols-2">
        <SummaryCard label="Commission rate" value={data.commissionRateLabel} />
        <SummaryCard
          label="Attribution window"
          value={data.attributionWindowLabel}
        />
      </div>

      <div className="pa-partner-card mt-5 max-w-[1000px] overflow-hidden">
        {rows.map((row, index) => (
          <div
            key={row.label}
            className="flex items-start justify-between gap-4 px-[22px] py-4"
            style={{
              borderBottom:
                index < rows.length - 1
                  ? "1px solid var(--border)"
                  : undefined,
            }}
          >
            <span
              className="shrink-0 text-[13.5px]"
              style={{ color: "rgba(55,53,47,.65)" }}
            >
              {row.label}
            </span>
            <span
              className="max-w-[560px] text-right text-[13.5px] font-medium"
              style={{ color: "var(--ink)" }}
            >
              {row.value}
            </span>
          </div>
        ))}
      </div>

      {data.priorVersions.length > 0 ? (
        <div className="mt-6 max-w-[1000px]">
          <div
            className="mb-2 text-[13px] font-semibold"
            style={{ color: "var(--ink)" }}
          >
            Previous versions
          </div>
          <ul className="m-0 list-none p-0">
            {data.priorVersions.map((item) => (
              <li
                key={item.id}
                className="flex items-center justify-between gap-3 border-b py-2.5 last:border-b-0"
                style={{ borderColor: "var(--border)" }}
              >
                <Link
                  href={item.href}
                  className="text-[13.5px] font-medium no-underline"
                  style={{ color: "var(--accent)" }}
                >
                  {item.title} v{item.version}
                </Link>
                <span
                  className="text-[12.5px]"
                  style={{ color: "var(--text-tertiary)" }}
                >
                  {item.dateLabel}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p
          className="mt-4 mb-0 max-w-[1000px] text-[12.5px]"
          style={{ color: "var(--text-tertiary)" }}
        >
          These are the currently applicable terms. Earlier Program Terms
          versions appear here when archived terms documents are on file — see{" "}
          <Link
            href={documentsListHref({ tab: "archived" })}
            className="no-underline"
            style={{ color: "var(--accent)" }}
          >
            Archived
          </Link>{" "}
          in Documents.
        </p>
      )}
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="pa-partner-card p-[22px]">
      <div
        className="mb-1 text-[12.5px]"
        style={{ color: "var(--text-tertiary)" }}
      >
        {label}
      </div>
      <div
        className="text-[24px] font-bold leading-tight tracking-[-0.02em] tabular-nums"
        style={{ color: "var(--ink)" }}
      >
        {value}
      </div>
    </div>
  );
}
