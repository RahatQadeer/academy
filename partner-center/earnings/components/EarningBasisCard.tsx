import type { EarningLedger } from "@/partner-center/earnings/types";

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div
        className="mb-[3px] text-[12.5px]"
        style={{ color: "var(--text-tertiary)" }}
      >
        {label}
      </div>
      <div className="text-[13.5px]" style={{ color: "var(--ink)" }}>
        {value}
      </div>
    </div>
  );
}

export function EarningBasisCard({ data }: { data: EarningLedger }) {
  return (
    <div className="pa-partner-card mb-4 p-6">
      <div
        className="mb-4 text-[13.5px] font-semibold"
        style={{ color: "var(--ink)" }}
      >
        Earning basis
      </div>
      <div className="grid grid-cols-1 gap-x-6 gap-y-[18px] sm:grid-cols-2">
        <Field label="Program" value={data.programLabel} />
        <Field label="Rate" value={data.rateLabel} />
        <Field label="Basis" value={data.basisLabel} />
        <Field label="Eligible period" value={data.eligiblePeriod} />
        <Field label="Payment terms" value={data.paymentTerms} />
        <Field label="Source" value={data.sourceLabel} />
      </div>
    </div>
  );
}
