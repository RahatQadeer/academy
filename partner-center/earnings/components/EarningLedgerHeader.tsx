import Link from "next/link";
import { Pill } from "@/base/components/Pill";
import { PartnerChrome } from "@/partner-center/components/PartnerChrome";
import {
  earningStatusLabel,
  earningStatusTone,
  formatMoney,
} from "@/partner-center/earnings/lib/format";
import type { EarningLedger } from "@/partner-center/earnings/types";

export function EarningLedgerHeader({ data }: { data: EarningLedger }) {
  return (
    <>
      <PartnerChrome title={data.title} subtitle={data.displayId} />
      <Link
        href="/partner-center/earnings/all"
        className="mb-4 inline-flex w-fit text-[13px] no-underline hover:underline"
        style={{ color: "var(--text-tertiary)" }}
      >
        ← Back to all earnings
      </Link>

      <div className="mb-6 flex items-start justify-between gap-6">
        <div className="min-w-0">
          <div className="mt-0.5">
            <Pill tone={earningStatusTone(data.status)}>
              {earningStatusLabel(data.status)}
            </Pill>
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div
            className="text-[12.5px]"
            style={{ color: "var(--text-tertiary)" }}
          >
            Total earned
          </div>
          <div
            className="text-[24px] font-bold leading-tight"
            style={{ color: "var(--ink)" }}
          >
            {formatMoney(data.totalEarned)}
          </div>
        </div>
      </div>
    </>
  );
}
