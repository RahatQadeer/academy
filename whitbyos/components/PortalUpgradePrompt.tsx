import Link from "next/link";

/**
 * Shown wherever Client Portal would have been offered, when the Whitby plan
 * does not include it. Not a nav item: the portal is a plan capability, and
 * this is the way onto a plan that has it.
 */
export function PortalUpgradePrompt({
  href = "/whitbyos/settings/billing",
}: {
  href?: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between gap-3 rounded-[10px] border px-4 py-3.5 no-underline hover:!text-ink"
      style={{
        borderColor: "var(--chrome-line)",
        background: "var(--surface-soft)",
        color: "var(--ink)",
      }}
    >
      <span className="min-w-0">
        <span className="block text-[13.5px] font-semibold">Enable Client Portal</span>
        <span className="mt-0.5 block text-[12.5px] leading-snug" style={{ color: "var(--text-secondary)" }}>
          Upgrade your plan
        </span>
      </span>
      <span aria-hidden className="shrink-0 text-[14px] font-semibold" style={{ color: "var(--accent)" }}>
        →
      </span>
    </Link>
  );
}
