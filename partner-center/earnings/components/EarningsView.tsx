import { EarningsEmptyState } from "@/partner-center/earnings/components/EarningsEmptyState";
import { EarningsHeader } from "@/partner-center/earnings/components/EarningsHeader";
import { EarningsHoldBanner } from "@/partner-center/earnings/components/EarningsHoldBanner";
import { EarningsTotals } from "@/partner-center/earnings/components/EarningsTotals";
import { PaymentTermsCard } from "@/partner-center/earnings/components/PaymentTermsCard";
import { ProgramRatesCard } from "@/partner-center/earnings/components/ProgramRatesCard";
import { RecentEarningsTable } from "@/partner-center/earnings/components/RecentEarningsTable";
import type { EarningsOverview } from "@/partner-center/earnings/types";

export function EarningsView({ data }: { data: EarningsOverview }) {
  return (
    <div className="flex min-h-full flex-col px-5 py-6 sm:px-6 lg:px-8 xl:px-12">
      <EarningsHeader />

      <EarningsTotals
        totals={data.totals}
        paidPayoutCount={data.paidPayoutCount}
        payoutGate={data.payoutGate}
      />

      {data.payoutGate !== "eligible" ? (
        <EarningsHoldBanner gate={data.payoutGate} />
      ) : null}

      <div className="mb-6 grid gap-4 md:grid-cols-2">
        <ProgramRatesCard programs={data.programs} />
        <PaymentTermsCard terms={data.paymentTerms} />
      </div>

      {data.isEmpty ? (
        <EarningsEmptyState />
      ) : (
        <RecentEarningsTable
          items={data.items}
          emptyMessage="No earnings yet."
        />
      )}
    </div>
  );
}
