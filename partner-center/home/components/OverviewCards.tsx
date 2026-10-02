import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  Building2,
  CircleDollarSign,
  FileText,
  Share2,
} from "lucide-react";
import { Pill } from "@/base/components/Pill";
import type {
  EarningsTotals,
  OpportunityCounts,
  ProgramRow,
  ReferralCounts,
} from "@/partner-center/home/types";
import { formatMoney } from "@/partner-center/referrals/lib/format";

function Stat({
  value,
  label,
  href,
  emphasize,
}: {
  value: string | number;
  label: string;
  href?: string;
  emphasize?: boolean;
}) {
  const number = (
    <div
      className="text-[22px] font-bold leading-none tracking-[-0.3px] tabular-nums sm:text-[26px]"
      style={{ color: emphasize ? "var(--success-fg)" : "var(--ink)" }}
    >
      {value}
    </div>
  );
  return (
    <div>
      {href ? (
        <Link href={href} className="no-underline">
          {number}
        </Link>
      ) : (
        number
      )}
      <div
        className="mt-1 text-[12.5px]"
        style={{ color: "var(--text-secondary)" }}
      >
        {label}
      </div>
    </div>
  );
}

function Card({
  title,
  icon: Icon,
  children,
  footer,
}: {
  title: string;
  icon: LucideIcon;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="pa-partner-card p-4 sm:p-5 lg:p-6">
      <div
        className="mb-4 flex items-center gap-2.5 text-[13.5px] font-semibold"
        style={{ color: "var(--ink)" }}
      >
        <span
          className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-[7px]"
          style={{
            background: "var(--accent-tint)",
            color: "var(--accent)",
          }}
          aria-hidden
        >
          <Icon size={14} strokeWidth={2.25} />
        </span>
        {title}
      </div>
      {children}
      {footer ? (
        <div
          className="mt-3.5 border-t pt-3 text-[12.5px]"
          style={{
            borderColor: "var(--border)",
            color: "var(--text-tertiary)",
          }}
        >
          {footer}
        </div>
      ) : null}
    </div>
  );
}

export function OverviewCards({
  referrals,
  opportunities,
  earnings,
  earningsTermsLine,
  programs,
}: {
  referrals: ReferralCounts;
  opportunities: OpportunityCounts;
  earnings: EarningsTotals;
  earningsTermsLine: string;
  programs: ProgramRow[];
}) {
  return (
    <div className="grid gap-3 sm:gap-4 md:grid-cols-2">
      <Card title="Referrals" icon={Share2}>
        <div className="flex flex-wrap justify-between gap-3 sm:gap-4">
          <Stat
            value={referrals.referred}
            label="Referred"
            href="/partner-center/referrals?status=referred"
          />
          <Stat
            value={referrals.inProgress}
            label="In Progress"
            href="/partner-center/referrals?status=in_progress"
          />
          <Stat
            value={referrals.converted}
            label="Converted"
            href="/partner-center/referrals?status=converted"
            emphasize
          />
        </div>
      </Card>

      <Card title="Enterprise Opportunities" icon={Building2}>
        <div className="flex flex-wrap justify-between gap-3 sm:gap-4">
          <Stat
            value={opportunities.submitted}
            label="Submitted"
            href="/partner-center/opportunities?status=submitted"
          />
          <Stat
            value={opportunities.inProgress}
            label="Accepted / In Progress"
            href="/partner-center/opportunities?status=accepted_in_progress"
          />
          <Stat
            value={opportunities.converted}
            label="Converted"
            href="/partner-center/opportunities?status=converted"
            emphasize
          />
        </div>
      </Card>

      <Card title="Earnings" icon={CircleDollarSign} footer={earningsTermsLine}>
        <div className="flex flex-wrap justify-between gap-3 sm:gap-4">
          <Stat
            value={formatMoney(earnings.pending)}
            label="Pending"
            href="/partner-center/earnings?status=pending"
          />
          <Stat
            value={formatMoney(earnings.payable)}
            label="Payable"
            href="/partner-center/earnings?status=payable"
          />
          {earnings.held > 0 ? (
            <Stat
              value={formatMoney(earnings.held)}
              label="Held"
              href="/partner-center/earnings?status=held"
            />
          ) : null}
          <Stat
            value={formatMoney(earnings.paid)}
            label="Paid"
            href="/partner-center/earnings?status=paid"
          />
        </div>
      </Card>

      <Card title="Programs & Terms" icon={FileText}>
        <div className="flex flex-col">
          {programs.map((program) => (
            <div
              key={program.key}
              className="flex items-center justify-between py-2"
            >
              <span
                className="text-[13.5px]"
                style={{
                  color: program.active
                    ? "var(--ink)"
                    : "var(--text-tertiary)",
                }}
              >
                {program.label}
              </span>
              {program.active ? (
                <Pill tone="success">{program.rateLabel}</Pill>
              ) : (
                <Pill tone="neutral">
                  {program.rateLabel && program.rateLabel !== "—"
                    ? program.rateLabel
                    : "—"}
                </Pill>
              )}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
