import Link from "next/link";
import { cn } from "@/base/lib/cn";
import {
  PC_ADMIN,
  type ProgramConfigSection,
} from "@/super-admin/partner-center/lib/paths";

const TABS: { key: ProgramConfigSection; label: string }[] = [
  { key: "commission", label: "Commission defaults" },
  { key: "attribution", label: "Attribution" },
  { key: "enterprise", label: "Enterprise protection" },
  { key: "product-interests", label: "Product interests" },
  { key: "tax", label: "Tax & payouts" },
  { key: "quickbooks", label: "QuickBooks" },
  { key: "firstpromoter", label: "FirstPromoter" },
];

export function ProgramConfigShell({
  active,
  children,
}: {
  active: ProgramConfigSection;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-10 md:flex-row md:gap-10">
      <nav className="w-full shrink-0 md:w-[200px]" aria-label="Program config">
        <div
          className="mb-2.5 text-[12.5px] font-semibold uppercase tracking-[0.03em]"
          style={{ color: "var(--text-tertiary)" }}
        >
          Program config
        </div>
        <ul className="m-0 flex list-none flex-wrap gap-0.5 p-0 md:flex-col">
          {TABS.map((tab) => {
            const isActive = tab.key === active;
            return (
              <li key={tab.key}>
                <Link
                  href={PC_ADMIN.programConfigSection(tab.key)}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "block rounded-[6px] px-2.5 py-2 text-[13.5px] no-underline",
                    isActive ? "font-semibold" : "font-normal",
                  )}
                  style={{
                    background: isActive ? "#efefed" : "transparent",
                    color: isActive ? "var(--ink)" : "rgba(55,53,47,.85)",
                  }}
                >
                  {tab.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="min-w-0 flex-1 max-w-[720px]">{children}</div>
    </div>
  );
}
