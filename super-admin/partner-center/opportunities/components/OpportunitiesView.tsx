"use client";

import Link from "next/link";
import { cn } from "@/base/lib/cn";
import { AdminClickableRow } from "@/super-admin/partner-center/components/AdminClickableRow";
import { AdminStatusPill } from "@/super-admin/partner-center/components/AdminStatusPill";
import {
  formatShortDate,
  opportunityStatusLabel,
  opportunityStatusTone,
} from "@/super-admin/partner-center/lib/format";
import { humanizeProductInterest } from "@/partner-center/opportunities/lib/product-interest-shared";
import type {
  AdminOpportunityListItem,
  OpportunityTab,
} from "@/super-admin/partner-center/types";
import { useAdminUiPaths } from "@/super-admin/partner-center/lib/admin-ui-paths";

const TABS: { id: OpportunityTab; label: string }[] = [
  { id: "all", label: "All" },
  { id: "submitted", label: "Submitted" },
  { id: "accepted", label: "Accepted" },
  { id: "in_progress", label: "In progress" },
  { id: "converted", label: "Converted" },
  { id: "closed", label: "Closed" },
];

function productInterestLabel(value: string | null) {
  return humanizeProductInterest(value);
}

export function OpportunitiesView({
  items,
  activeTab,
  submittedCount = 0,
}: {
  items: AdminOpportunityListItem[];
  activeTab: OpportunityTab;
  submittedCount?: number;
}) {
  const paths = useAdminUiPaths();
  const listHref = paths.opportunities;
  return (
    <div>
      <div
        className="mb-5 flex flex-wrap gap-x-6 gap-y-2"
        style={{ borderBottom: "1px solid var(--border)" }}
        role="tablist"
      >
        {TABS.map((tab) => {
          const selected = tab.id === activeTab;
          const badge =
            tab.id === "submitted" && submittedCount > 0
              ? submittedCount
              : null;
          return (
            <Link
              key={tab.id}
              href={`${listHref}?tab=${tab.id}`}
              className={cn(
                "mb-[-1px] border-0 bg-transparent pb-3 text-[14px] no-underline",
              )}
              style={{
                fontWeight: selected ? 600 : 400,
                color: selected ? "var(--ink)" : "var(--text-tertiary)",
                borderBottom: selected
                  ? "2px solid var(--ink)"
                  : "2px solid transparent",
              }}
            >
              {tab.label}
              {badge != null ? (
                <span
                  className="ml-2 inline-flex min-w-[20px] items-center justify-center rounded-full px-1.5 py-0.5 text-[11.5px] font-semibold"
                  style={{
                    background: "var(--ink)",
                    color: "var(--surface)",
                  }}
                >
                  {badge}
                </span>
              ) : null}
            </Link>
          );
        })}
      </div>

      {items.length === 0 ? (
        <p className="text-[14px]" style={{ color: "var(--text-secondary)" }}>
          No opportunities in this view.
        </p>
      ) : (
        <div className="pa-partner-card overflow-hidden">
          <table className="w-full border-collapse text-left text-[13.5px]">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                {[
                  "Company",
                  "Partner",
                  "Contact",
                  "Interest",
                  "Status",
                  "Submitted",
                ].map((heading) => (
                  <th
                    key={heading}
                    className="px-4 py-3 text-[11.5px] font-semibold uppercase tracking-[0.04em]"
                    style={{ color: "var(--text-tertiary)" }}
                  >
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <AdminClickableRow
                  key={item.id}
                  href={paths.opportunity(item.id)}
                >
                  <td className="px-4 py-3 font-medium" style={{ color: "var(--ink)" }}>
                    <span className="inline-flex items-center gap-2">
                      {item.companyName}
                      {item.status.toLowerCase() === "submitted" ? (
                        <AdminStatusPill label="New" tone="info" />
                      ) : null}
                    </span>
                  </td>
                  <td className="px-4 py-3" style={{ color: "var(--text-secondary)" }}>
                    {item.partnerCompanyName}
                  </td>
                  <td className="px-4 py-3" style={{ color: "var(--text-secondary)" }}>
                    {item.contactName || "—"}
                  </td>
                  <td className="px-4 py-3" style={{ color: "var(--text-secondary)" }}>
                    {productInterestLabel(item.productInterest)}
                  </td>
                  <td className="px-4 py-3">
                    <AdminStatusPill
                      label={opportunityStatusLabel(item.status)}
                      tone={opportunityStatusTone(item.status)}
                    />
                  </td>
                  <td className="px-4 py-3" style={{ color: "var(--text-secondary)" }}>
                    {formatShortDate(item.submittedAt)}
                  </td>
                </AdminClickableRow>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
