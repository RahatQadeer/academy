"use client";

import Link from "next/link";
import { cn } from "@/base/lib/cn";
import { ReferralsTable } from "@/super-admin/partner-center/referrals/components/ReferralsTable";
import { useAdminUiPaths } from "@/super-admin/partner-center/lib/admin-ui-paths";
import type {
  AdminReferralListItem,
  ReferralTab,
} from "@/super-admin/partner-center/types";

const TABS: { id: ReferralTab; label: string }[] = [
  { id: "all", label: "All" },
  { id: "referred", label: "Referred" },
  { id: "in_progress", label: "In progress" },
  { id: "converted", label: "Converted" },
  { id: "not_converted", label: "Not converted" },
];

export function ReferralsView({
  items,
  activeTab,
}: {
  items: AdminReferralListItem[];
  activeTab: ReferralTab;
}) {
  const paths = useAdminUiPaths();

  return (
    <div>
      <div
        className="mb-5 flex flex-wrap gap-x-6 gap-y-2"
        style={{ borderBottom: "1px solid var(--border)" }}
        role="tablist"
      >
        {TABS.map((tab) => {
          const selected = tab.id === activeTab;
          return (
            <Link
              key={tab.id}
              href={`${paths.referrals}?tab=${tab.id}`}
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

      <ReferralsTable items={items} />
    </div>
  );
}
