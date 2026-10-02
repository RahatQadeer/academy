import Link from "next/link";
import type { PayoutGate } from "@/partner-center/lib/payout-gate";
import { payoutBannerCopy } from "@/partner-center/earnings/lib/payout-status";

export function PayoutGateBanner({
  gate,
}: {
  gate: Exclude<PayoutGate, "eligible">;
}) {
  const copy = payoutBannerCopy(gate);
  const isDanger = copy.tone === "danger";

  return (
    <div
      className="mb-6 flex items-center justify-between gap-4 rounded-lg px-[18px] py-3.5"
      style={{
        background: isDanger ? "var(--danger-bg)" : "var(--warning-bg)",
        border: `1px solid ${isDanger ? "var(--danger-bg)" : "var(--warning-border)"}`,
      }}
    >
      <span
        className="text-[13.5px]"
        style={{ color: isDanger ? "var(--danger-fg)" : "var(--warning-fg)" }}
      >
        {copy.message}
      </span>
      <Link
        href={copy.href}
        className="shrink-0 text-[13px] font-semibold no-underline"
        style={{ color: isDanger ? "var(--danger-fg)" : "var(--warning-fg)" }}
      >
        {copy.ctaLabel}
      </Link>
    </div>
  );
}
