"use client";

import Link from "next/link";
import { AdminStatusPill } from "@/super-admin/partner-center/components/AdminStatusPill";
import {
  formatShortDate,
  referralProgramLabel,
  referralStatusLabel,
  referralStatusTone,
} from "@/super-admin/partner-center/lib/format";
import { useAdminUiPaths } from "@/super-admin/partner-center/lib/admin-ui-paths";
import type { AdminReferralListItem } from "@/super-admin/partner-center/types";

export function ReferralsTable({ items }: { items: AdminReferralListItem[] }) {
  const paths = useAdminUiPaths();

  if (items.length === 0) {
    return (
      <p className="text-[14px]" style={{ color: "var(--text-secondary)" }}>
        No referrals yet.
      </p>
    );
  }

  return (
    <div className="pa-partner-card overflow-hidden">
      <table className="w-full border-collapse text-left text-[13.5px]">
        <thead>
          <tr style={{ borderBottom: "1px solid var(--border)" }}>
            {["Referred", "Partner", "Program", "Status", "Date"].map(
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
            <tr
              key={item.id}
              style={{ borderBottom: "1px solid var(--border)" }}
              className="hover:bg-[#fafaf9]"
            >
              <td className="px-4 py-3">
                <Link
                  href={paths.referral(item.id)}
                  className="font-medium no-underline"
                  style={{ color: "var(--ink)" }}
                >
                  {item.referredName || item.referredEmail || "Referral"}
                </Link>
                {item.referredEmail ? (
                  <div
                    className="text-[12.5px]"
                    style={{ color: "var(--text-tertiary)" }}
                  >
                    {item.referredEmail}
                  </div>
                ) : null}
              </td>
              <td
                className="px-4 py-3"
                style={{ color: "var(--text-secondary)" }}
              >
                {item.partnerCompanyName}
              </td>
              <td
                className="px-4 py-3"
                style={{ color: "var(--text-secondary)" }}
              >
                {referralProgramLabel(item.program)}
              </td>
              <td className="px-4 py-3">
                <AdminStatusPill
                  label={referralStatusLabel(item.status)}
                  tone={referralStatusTone(item.status)}
                />
              </td>
              <td
                className="px-4 py-3"
                style={{ color: "var(--text-secondary)" }}
              >
                {formatShortDate(item.referralDate)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
