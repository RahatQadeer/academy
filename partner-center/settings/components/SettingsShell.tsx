import Link from "next/link";
import { cn } from "@/base/lib/cn";
import { PartnerChrome } from "@/partner-center/components/PartnerChrome";
import { PARTNER_PATHS } from "@/partner-center/lib/review-state";
import type { SettingsTab } from "@/partner-center/settings/types";

const TABS: { key: SettingsTab; label: string; href: string }[] = [
  {
    key: "profile",
    label: "Profile",
    href: PARTNER_PATHS.settingsProfile,
  },
  {
    key: "notifications",
    label: "Notifications",
    href: PARTNER_PATHS.settingsNotifications,
  },
  {
    key: "security",
    label: "Security",
    href: PARTNER_PATHS.settingsSecurity,
  },
  {
    key: "tax",
    label: "Tax and Payment",
    href: PARTNER_PATHS.settingsTax,
  },
];

export function SettingsShell({
  active,
  title,
  description,
  wide = false,
  children,
}: {
  active: SettingsTab;
  title: string;
  description?: string;
  /** Tax overview needs two status cards side-by-side. */
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-10 px-5 py-6 sm:px-6 md:flex-row md:gap-10 lg:px-8 xl:px-12">
      <PartnerChrome title={title} subtitle={description} />
      <nav className="w-full shrink-0 md:w-[200px]" aria-label="Settings">
        <div
          className="mb-2.5 text-[12.5px] font-semibold uppercase tracking-[0.03em]"
          style={{ color: "var(--text-tertiary)" }}
        >
          Settings
        </div>
        <ul className="m-0 flex list-none flex-wrap gap-0.5 p-0 md:flex-col">
          {TABS.map((tab) => {
            const isActive = tab.key === active;
            return (
              <li key={tab.key}>
                <Link
                  href={tab.href}
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

      <div className={cn("min-w-0 flex-1", wide ? "max-w-[880px]" : "max-w-[640px]")}>
        <div>{children}</div>
      </div>
    </div>
  );
}
