"use client";

import { AdminClickableRow } from "@/super-admin/partner-center/components/AdminClickableRow";
import { AdminStatusPill } from "@/super-admin/partner-center/components/AdminStatusPill";
import {
  formatShortDate,
  profileStatusLabel,
  profileStatusTone,
} from "@/super-admin/partner-center/lib/format";
import { useAdminUiPaths } from "@/super-admin/partner-center/lib/admin-ui-paths";
import type { PartnerListItem } from "@/super-admin/partner-center/types";

export function PartnersTable({ items }: { items: PartnerListItem[] }) {
  const paths = useAdminUiPaths();

  if (items.length === 0) {
    return (
      <p className="text-[14px]" style={{ color: "var(--text-secondary)" }}>
        No approved or active partners yet.
      </p>
    );
  }

  return (
    <div className="pa-partner-card overflow-hidden">
      <table className="w-full border-collapse text-left text-[13.5px]">
        <thead>
          <tr style={{ borderBottom: "1px solid var(--border)" }}>
            {[
              "Company",
              "Contact",
              "Programs",
              "Status",
              "Payout",
              "Active",
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
            <AdminClickableRow key={item.id} href={paths.partner(item.id)}>
              <td className="px-4 py-3 font-medium" style={{ color: "var(--ink)" }}>
                {item.companyName}
              </td>
              <td className="px-4 py-3">
                <div>{item.contactName}</div>
                <div className="text-[12.5px]" style={{ color: "var(--text-tertiary)" }}>
                  {item.contactEmail}
                </div>
              </td>
              <td className="px-4 py-3" style={{ color: "var(--text-secondary)" }}>
                {item.programsLabel}
              </td>
              <td className="px-4 py-3">
                <AdminStatusPill
                  label={profileStatusLabel(item.status)}
                  tone={profileStatusTone(item.status)}
                />
              </td>
              <td className="px-4 py-3" style={{ color: "var(--text-secondary)" }}>
                {item.payoutEligibility.replace(/_/g, " ")}
              </td>
              <td className="px-4 py-3" style={{ color: "var(--text-secondary)" }}>
                {item.activatedAt ? formatShortDate(item.activatedAt) : "—"}
              </td>
            </AdminClickableRow>
          ))}
        </tbody>
      </table>
    </div>
  );
}
