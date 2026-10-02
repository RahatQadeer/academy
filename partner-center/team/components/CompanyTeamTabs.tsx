"use client";

import Link from "next/link";
import type { TeamTab } from "@/partner-center/team/types";

const TABS: { id: TeamTab; label: string }[] = [
  { id: "profile", label: "Company Profile" },
  { id: "team", label: "Team" },
];

export function CompanyTeamTabs({ active }: { active: TeamTab }) {
  return (
    <div
      className="mt-5 flex gap-6 overflow-x-auto overflow-y-hidden border-b"
      style={{ borderColor: "var(--border)" }}
      role="tablist"
    >
      {TABS.map((tab) => {
        const isActive = tab.id === active;
        const href =
          tab.id === "profile"
            ? "/partner-center/team"
            : "/partner-center/team?tab=team";
        return (
          <Link
            key={tab.id}
            href={href}
            role="tab"
            aria-selected={isActive}
            className="relative -mb-px shrink-0 pb-2.5 text-[14px] font-medium no-underline"
            style={{
              color: isActive ? "var(--ink)" : "var(--text-secondary)",
              boxShadow: isActive
                ? "inset 0 -2px 0 var(--ink)"
                : "inset 0 -2px 0 transparent",
            }}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
