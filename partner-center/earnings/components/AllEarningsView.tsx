import Link from "next/link";
import { PartnerChrome } from "@/partner-center/components/PartnerChrome";
import { EarningsEmptyState } from "@/partner-center/earnings/components/EarningsEmptyState";
import { EarningsFilters } from "@/partner-center/earnings/components/EarningsFilters";
import { EarningsTable } from "@/partner-center/earnings/components/EarningsTable";
import type { EarningsOverview } from "@/partner-center/earnings/types";

export function AllEarningsView({ data }: { data: EarningsOverview }) {
  return (
    <div className="flex min-h-full flex-col px-5 py-6 sm:px-6 lg:px-8 xl:px-12">
      <PartnerChrome
        title="All earnings"
        subtitle="Every commission across Academy, Whitby, and Enterprise."
      />
      <Link
        href="/partner-center/earnings"
        className="mb-4 inline-flex w-fit text-[13px] no-underline hover:underline"
        style={{ color: "var(--text-tertiary)" }}
      >
        ← Back to Earnings
      </Link>

      {data.isEmpty ? (
        <EarningsEmptyState />
      ) : (
        <>
          <EarningsFilters active={data.statusFilter} />
          <EarningsTable
            items={data.items}
            emptyMessage="No earnings match this status."
            title="Earnings"
          />
        </>
      )}
    </div>
  );
}
