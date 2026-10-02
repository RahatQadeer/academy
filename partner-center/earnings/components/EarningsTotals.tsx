import type { LucideIcon } from "lucide-react";
import {
  CircleCheck,
  CircleDollarSign,
  Clock3,
  PauseCircle,
} from "lucide-react";
import { cn } from "@/base/lib/cn";
import type { PayoutGate } from "@/partner-center/lib/payout-gate";
import { payableGateSubtitle } from "@/partner-center/earnings/lib/payout-status";
import { formatMoney } from "@/partner-center/earnings/lib/format";
import type { EarningsTotals } from "@/partner-center/earnings/types";
import { pcType } from "@/partner-center/lib/typography";

function Card({
  label,
  amount,
  subtitle,
  subtitleWarning,
  icon: Icon,
}: {
  label: string;
  amount: number;
  subtitle: string;
  subtitleWarning?: boolean;
  icon: LucideIcon;
}) {
  return (
    <div className="pa-partner-card p-5 sm:p-6">
      <div className="mb-3 flex items-center gap-2.5">
        <span
          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px]"
          style={{
            background: "var(--accent-tint)",
            color: "var(--accent)",
          }}
          aria-hidden
        >
          <Icon size={15} strokeWidth={2.25} />
        </span>
        <div
          className={cn(
            pcType.micro,
            "font-semibold uppercase tracking-[0.06em]",
          )}
          style={{ color: "var(--text-tertiary)" }}
        >
          {label}
        </div>
      </div>
      <div
        className="text-[26px] font-bold leading-none tracking-[-0.5px] tabular-nums sm:text-[28px]"
        style={{ color: "var(--ink)" }}
      >
        {formatMoney(amount)}
      </div>
      <div
        className={cn("mt-2", pcType.meta)}
        style={{
          color: subtitleWarning
            ? "var(--warning-fg)"
            : "var(--text-soft, var(--text-tertiary))",
        }}
      >
        {subtitle}
      </div>
    </div>
  );
}

export function EarningsTotals({
  totals,
  paidPayoutCount,
  payoutGate,
}: {
  totals: EarningsTotals;
  paidPayoutCount: number;
  payoutGate: PayoutGate;
}) {
  const gateSubtitle = payableGateSubtitle(payoutGate);
  const pendingSubtitle =
    totals.pending > 0 ? "Awaiting review window" : "No pending earnings";
  const payableSubtitle = gateSubtitle || "Ready for payout";
  const payoutWord = paidPayoutCount === 1 ? "payout" : "payouts";
  const paidSubtitle = `Lifetime, ${paidPayoutCount} ${payoutWord}`;
  const heldSubtitle =
    totals.held > 0
      ? "New-partner waiting period"
      : "No held earnings";
  const reversedNote =
    totals.reversed !== 0
      ? `${formatMoney(totals.reversed)} reversed after refund or chargeback`
      : null;

  return (
    <div className="mb-6">
      <div className="grid gap-3 sm:gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card
          label="Held"
          amount={totals.held}
          subtitle={heldSubtitle}
          icon={PauseCircle}
        />
        <Card
          label="Pending"
          amount={totals.pending}
          subtitle={pendingSubtitle}
          icon={Clock3}
        />
        <Card
          label="Payable"
          amount={totals.payable}
          subtitle={payableSubtitle}
          subtitleWarning={Boolean(gateSubtitle)}
          icon={CircleDollarSign}
        />
        <Card
          label="Paid"
          amount={totals.paid}
          subtitle={paidSubtitle}
          icon={CircleCheck}
        />
      </div>
      {reversedNote ? (
        <p
          className="m-0 mt-3 text-[12.5px]"
          style={{ color: "var(--text-secondary)" }}
        >
          {reversedNote}
        </p>
      ) : null}
    </div>
  );
}
