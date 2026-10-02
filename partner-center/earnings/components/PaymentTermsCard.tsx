import type { PaymentTermsSummary } from "@/partner-center/earnings/types";

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-[13.5px]" style={{ color: "var(--ink)" }}>
        {label}
      </span>
      <span className="text-[13.5px]" style={{ color: "var(--ink)" }}>
        {value}
      </span>
    </div>
  );
}

export function PaymentTermsCard({ terms }: { terms: PaymentTermsSummary }) {
  return (
    <div className="pa-partner-card p-6">
      <div
        className="mb-4 text-[13.5px] font-semibold"
        style={{ color: "var(--ink)" }}
      >
        Payment terms
      </div>
      <Row label="Payout timing" value={terms.schedule} />
      <Row label="Eligible period" value={terms.eligiblePeriod} />
      <Row label="Next payout run" value={terms.nextPayout} />
    </div>
  );
}
