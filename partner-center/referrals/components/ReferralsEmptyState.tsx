import { ArrowUpRight } from "lucide-react";
import { GetReferralLinkButton } from "@/partner-center/referrals/components/GetReferralLinkButton";

export function ReferralsEmptyState() {
  return (
    <div className="flex flex-1 items-center justify-center py-16">
      <div className="max-w-[420px] text-center">
        <div
          className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-[10px]"
          style={{ background: "var(--accent-tint)", color: "var(--accent)" }}
          aria-hidden
        >
          <ArrowUpRight size={22} strokeWidth={2.25} />
        </div>
        <h2
          className="m-0 mb-2 text-[18px] font-semibold tracking-[-0.2px]"
          style={{ color: "var(--ink)" }}
        >
          No referrals yet
        </h2>
        <p
          className="m-0 mb-6 text-[14px] leading-[1.55]"
          style={{ color: "var(--text-secondary)" }}
        >
          Share your referral link and every person who signs up through it will
          show up here, from first click to conversion.
        </p>
        <div className="flex justify-center">
          <GetReferralLinkButton label="Get my referral link" />
        </div>
      </div>
    </div>
  );
}
