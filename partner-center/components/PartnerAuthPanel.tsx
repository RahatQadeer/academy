import { PartnerAuthStatRow } from "@/partner-center/components/PartnerAuthStatRow";

export function PartnerAuthPanel() {
  return (
    <div className="flex h-full flex-col justify-center text-white">
      <div className="max-w-[460px]">
        <p
          className="mb-4 text-[12.5px] font-semibold uppercase tracking-[0.08em]"
          style={{ color: "rgba(255,255,255,.65)" }}
        >
          Partner Program
        </p>
        <h2 className="text-[24px] font-bold leading-[1.1] tracking-[-0.4px]">
          Introduce Private Attaché. Earn on every client you bring.
        </h2>
        <p
          className="mt-5 text-[16px] leading-[1.6]"
          style={{ color: "rgba(255,255,255,.65)" }}
        >
          Refer Academy learners or Whitby customers with a single link, or
          register an Enterprise opportunity for larger organizations. Terms are
          confirmed with you after approval.
        </p>

        <div className="mt-9">
          <PartnerAuthStatRow label="Academy referral commission" value="15%" />
          <PartnerAuthStatRow label="Whitby subscription commission" value="15%" />
          <PartnerAuthStatRow label="Payouts" value="Stripe Connect" />
        </div>

        <figure
          className="mt-10 pt-8"
          style={{ borderTop: "1px solid rgba(255,255,255,.28)" }}
        >
          <blockquote className="text-[16px] leading-[1.6] text-white">
            “We started referring family office clients within a week of approval,
            and every attributed payment shows up on its own.”
          </blockquote>
          <figcaption
            className="mt-4 text-[13px]"
            style={{ color: "rgba(255,255,255,.65)" }}
          >
            Referral Partner, since 2024
          </figcaption>
        </figure>
      </div>
    </div>
  );
}
