"use client";

import Link from "next/link";
import { cn } from "@/base/lib/cn";
import { AdminClickableRow } from "@/super-admin/partner-center/components/AdminClickableRow";
import { AdminStatusPill } from "@/super-admin/partner-center/components/AdminStatusPill";
import {
  formatShortDate,
  profileStatusLabel,
  profileStatusTone,
} from "@/super-admin/partner-center/lib/format";
import { useAdminUiPaths } from "@/super-admin/partner-center/lib/admin-ui-paths";
import type { ApplicationListItem, ApplicationTab } from "@/super-admin/partner-center/types";

const TABS: { id: ApplicationTab; label: string }[] = [
  { id: "pending", label: "Pending" },
  { id: "all", label: "All" },
  { id: "approved", label: "Approved" },
  { id: "declined", label: "Declined" },
];

export function ApplicationsView({
  items,
  activeTab,
}: {
  items: ApplicationListItem[];
  activeTab: ApplicationTab;
}) {
  const paths = useAdminUiPaths();
  const listHref = paths.applications;
  return (
    <div>
      <div
        className="mb-5 flex gap-6"
        style={{ borderBottom: "1px solid var(--border)" }}
        role="tablist"
      >
        {TABS.map((tab) => {
          const selected = tab.id === activeTab;
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
            </Link>
          );
        })}
      </div>

      {items.length === 0 ? (
        <p className="text-[14px]" style={{ color: "var(--text-secondary)" }}>
          No applications in this view.
        </p>
      ) : (
        <div className="pa-partner-card overflow-hidden">
          <table className="w-full border-collapse text-left text-[13.5px]">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                {["Company", "Contact", "Programs", "Status", "Updated"].map(
                  (heading) => (
                    <th
                      key={heading}
                      className="px-4 py-3 text-[11.5px] font-semibold uppercase tracking-[0.04em]"
                      style={{ color: "var(--text-tertiary)" }}
                    >
                      {heading}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <AdminClickableRow
                  key={item.id}
                  href={paths.application(item.id)}
                >
                  <td className="px-4 py-3 font-medium" style={{ color: "var(--ink)" }}>
                    {item.companyName}
                  </td>
                  <td className="px-4 py-3">
                    <div>{item.contactName}</div>
                    <div
                      className="text-[12.5px]"
                      style={{ color: "var(--text-tertiary)" }}
                    >
                      {item.contactEmail}
                    </div>
                  </td>
                  <td className="px-4 py-3" style={{ color: "var(--text-secondary)" }}>
                    {item.productsLabel}
                  </td>
                  <td className="px-4 py-3">
                    <AdminStatusPill
                      label={
                        item.infoRequestActive
                          ? "More info needed"
                          : profileStatusLabel(item.status)
                      }
                      tone={
                        item.infoRequestActive
                          ? "warning"
                          : profileStatusTone(item.status)
                      }
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
