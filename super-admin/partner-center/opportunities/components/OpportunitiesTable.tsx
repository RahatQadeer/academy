import Link from "next/link";
import { AdminStatusPill } from "@/super-admin/partner-center/components/AdminStatusPill";
import {
  formatShortDate,
  opportunityStatusLabel,
  opportunityStatusTone,
} from "@/super-admin/partner-center/lib/format";
import { PC_ADMIN } from "@/super-admin/partner-center/lib/paths";
import { humanizeProductInterest } from "@/partner-center/opportunities/lib/product-interest-shared";
import type { AdminOpportunityListItem } from "@/super-admin/partner-center/types";

function productInterestLabel(value: string | null) {
  return humanizeProductInterest(value);
}

export function OpportunitiesTable({ items }: { items: AdminOpportunityListItem[] }) {
  if (items.length === 0) {
    return (
      <p className="text-[14px]" style={{ color: "var(--text-secondary)" }}>
        No enterprise opportunities yet.
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
            <tr
              key={item.id}
              style={{ borderBottom: "1px solid var(--border)" }}
              className="hover:bg-[#fafaf9]"
            >
              <td className="px-4 py-3">
                <Link
                  href={PC_ADMIN.opportunity(item.id)}
                  className="font-medium no-underline"
                  style={{ color: "var(--ink)" }}
                >
                  {item.companyName}
                </Link>
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
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
