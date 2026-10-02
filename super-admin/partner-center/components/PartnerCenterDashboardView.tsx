"use client";

import Link from "next/link";
import { useAdminUiPaths, useAdminUiMode } from "@/super-admin/partner-center/lib/admin-ui-paths";

function StatCard({
  label,
  value,
  href,
  hint,
}: {
  label: string;
  value: number;
  href: string;
  hint?: string;
}) {
  return (
    <Link
      href={href}
      className="pa-partner-card block px-5 py-5 no-underline transition-colors hover:bg-[#fafaf9]"
      style={{ color: "var(--ink)" }}
    >
      <div className="text-[24px] font-bold leading-none">{value}</div>
      <div className="mt-2 text-[13px] font-medium">{label}</div>
      {hint ? (
        <div className="mt-1 text-[12px]" style={{ color: "var(--text-tertiary)" }}>
          {hint}
        </div>
      ) : null}
    </Link>
  );
}

function QuickLinkCard({
  href,
  title,
  description,
}: {
  href: string;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="pa-partner-card group flex flex-col px-4 py-4 no-underline transition-colors hover:bg-[#fafaf9]"
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-[14px] font-semibold" style={{ color: "var(--ink)" }}>
          {title}
        </span>
        <span
          aria-hidden
          className="text-[14px] transition-transform group-hover:translate-x-0.5"
          style={{ color: "var(--accent)" }}
        >
          →
        </span>
      </div>
      <p
        className="m-0 mt-1.5 text-[12.5px] leading-[1.45]"
        style={{ color: "var(--text-secondary)" }}
      >
        {description}
      </p>
    </Link>
  );
}

export function PartnerCenterDashboardView({
  pendingApplications,
  submittedOpportunities,
  activePartners,
  failedPayouts,
}: {
  pendingApplications: number;
  submittedOpportunities: number;
  activePartners: number;
  failedPayouts: number;
}) {
  const paths = useAdminUiPaths();
  const mode = useAdminUiMode();
  const isPartnerAdmin = mode === "partner_admin";

  const links = [
    {
      href: `${paths.applications}?tab=pending`,
      title: "Review applications",
      description: "Approve, decline, or request more info.",
    },
    {
      href: `${paths.opportunities}?tab=submitted`,
      title: "Triage opportunities",
      description: isPartnerAdmin
        ? "Accept, move in progress, or close deals."
        : "Enterprise submissions and conversions.",
    },
    {
      href: paths.partners,
      title: "Monitor partners",
      description: "Roster, status, and payout readiness.",
    },
    {
      href: paths.messages,
      title: isPartnerAdmin ? "Partner Manager messages" : "Messages",
      description: isPartnerAdmin
        ? "Partner Manager channel only."
        : "Partner support threads.",
    },
    {
      href: paths.referrals,
      title: "Referral activity",
      description: "Pipeline by partner and program.",
    },
    {
      href: paths.payouts,
      title: "Payouts",
      description: isPartnerAdmin
        ? "View-only payout eligibility."
        : "Pay eligible partners.",
    },
    ...(!isPartnerAdmin
      ? [
          {
            href: "/super-admin",
            title: "All modules",
            description: "Back to Super Admin.",
          },
        ]
      : []),
  ];

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Applications pending review"
          value={pendingApplications}
          href={`${paths.applications}?tab=pending`}
          hint="Open queue →"
        />
        <StatCard
          label="Opportunities submitted"
          value={submittedOpportunities}
          href={`${paths.opportunities}?tab=submitted`}
          hint="Triage →"
        />
        <StatCard
          label="Approved / active partners"
          value={activePartners}
          href={paths.partners}
          hint="Roster →"
        />
        <StatCard
          label="Failed payouts"
          value={failedPayouts}
          href={paths.payouts}
          hint={isPartnerAdmin ? "View only →" : "Review →"}
        />
      </div>

      <div className="mt-8">
        <p
          className="mb-3 text-[12.5px] font-semibold uppercase tracking-[0.03em]"
          style={{ color: "var(--text-tertiary)" }}
        >
          {isPartnerAdmin ? "Work queue" : "Quick links"}
        </p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {links.map((link) => (
            <QuickLinkCard key={link.href} {...link} />
          ))}
        </div>
      </div>
    </>
  );
}
