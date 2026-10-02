import { Pill } from "@/base/components/Pill";
import { payoutStatusCopy } from "@/partner-center/earnings/lib/payout-status";
import type { EarningLedger } from "@/partner-center/earnings/types";

function StatusRow({
  label,
  value,
  tone,
  last,
}: {
  label: string;
  value: string;
  tone: "success" | "warning" | "danger" | "neutral" | "info" | "accent";
  last?: boolean;
}) {
  const color =
    tone === "success"
      ? "var(--success-fg)"
      : tone === "warning"
        ? "var(--warning-fg)"
        : tone === "danger"
          ? "var(--danger-fg)"
          : "var(--ink)";

  return (
    <div
      className="flex justify-between py-2"
      style={
        last
          ? undefined
          : { borderBottom: "1px solid var(--border)" }
      }
    >
      <span className="text-[13px]" style={{ color: "var(--text-secondary)" }}>
        {label}
      </span>
      <span className="text-[13px] font-semibold" style={{ color }}>
        {value}
      </span>
    </div>
  );
}

export function PayoutStatusCard({ data }: { data: EarningLedger }) {
  const copy = payoutStatusCopy(data.payoutGate);

  return (
    <div className="pa-partner-card p-6">
      <div
        className="mb-4 text-[13.5px] font-semibold"
        style={{ color: "var(--ink)" }}
      >
        Payout status
      </div>
      <div className="mb-3">
        <Pill tone={copy.badgeTone}>{copy.badge}</Pill>
      </div>
      <div
        className="mb-1 text-[14px] font-semibold"
        style={{ color: "var(--ink)" }}
      >
        {copy.title}
      </div>
      <p
        className="mb-4 mt-0 text-[12.5px] leading-[1.5]"
        style={{ color: "var(--text-secondary)" }}
      >
        {copy.description}
      </p>
      <StatusRow
        label="Tax profile"
        value={data.taxProfile.label}
        tone={data.taxProfile.tone}
      />
      <StatusRow
        label="Payment setup"
        value={data.paymentSetup.label}
        tone={data.paymentSetup.tone}
        last
      />
      <p
        className="mb-0 mt-3 border-t pt-3 text-[12.5px] leading-[1.5]"
        style={{
          borderColor: "var(--border)",
          color: "var(--text-tertiary)",
        }}
      >
        {copy.footer}
      </p>
    </div>
  );
}
