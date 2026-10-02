import { AdjustmentsTable } from "@/partner-center/earnings/components/AdjustmentsTable";
import { CollectedPaymentsTable } from "@/partner-center/earnings/components/CollectedPaymentsTable";
import { EarningBasisCard } from "@/partner-center/earnings/components/EarningBasisCard";
import { EarningLedgerHeader } from "@/partner-center/earnings/components/EarningLedgerHeader";
import { PayoutStatusCard } from "@/partner-center/earnings/components/PayoutStatusCard";
import type { EarningLedger } from "@/partner-center/earnings/types";

export function EarningLedgerView({ data }: { data: EarningLedger }) {
  return (
    <div className="flex min-h-full flex-col px-5 py-6 sm:px-6 lg:px-8 xl:px-12">
      <EarningLedgerHeader data={data} />

      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1.4fr)_minmax(260px,1fr)]">
        <div>
          <EarningBasisCard data={data} />
          <CollectedPaymentsTable payments={data.payments} />
          <AdjustmentsTable adjustments={data.adjustments} />
        </div>
        <PayoutStatusCard data={data} />
      </div>
    </div>
  );
}
