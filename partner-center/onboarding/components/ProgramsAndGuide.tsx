"use client";

import type { ReactNode } from "react";
import {
  confirmPartnerGuide,
  confirmProgramTerms,
} from "@/partner-center/lib/checklist-actions";
import type { ProgramTermsSummary } from "@/partner-center/lib/program-terms";
import { PARTNER_PATHS } from "@/partner-center/lib/review-state";
import type { PartnerProgramFamily } from "@/partner-center/types/application";
import {
  ConfirmContinueScreen,
  SetupListRow,
} from "@/partner-center/onboarding/components/ConfirmContinueScreen";

function enrolled(
  programs: PartnerProgramFamily[],
  id: PartnerProgramFamily,
) {
  return programs.includes(id);
}

function TermsPoint({ children }: { children: ReactNode }) {
  return (
    <li className="text-[13px] leading-[1.55]" style={{ color: "var(--warning-fg)" }}>
      {children}
    </li>
  );
}

export function ProgramsTermsScreen({
  companyName,
  terms,
  programs,
  readOnly = false,
}: {
  companyName: string;
  terms: ProgramTermsSummary;
  programs: PartnerProgramFamily[];
  readOnly?: boolean;
}) {
  const enterpriseOn = enrolled(programs, "enterprise");

  return (
    <ConfirmContinueScreen
      title="Programs & terms"
      description={`These are the programs and rates approved for ${companyName}.`}
      onConfirm={confirmProgramTerms}
      nextFallback={PARTNER_PATHS.guide}
      readOnly={readOnly}
      callout={
        <div
          className="mt-4 rounded-[10px] px-4 py-3.5"
          style={{
            background: "var(--warning-bg)",
            color: "var(--warning-fg)",
            border: "1px solid var(--warning-border)",
          }}
        >
          <div
            className="mb-2.5 text-[12.5px] font-semibold"
            style={{ color: "var(--warning-fg)" }}
          >
            How payouts work
          </div>
          <ul className="m-0 flex list-disc flex-col gap-2 pl-4">
            <TermsPoint>
              Eligible commission is {terms.payment.toLowerCase()}. Amounts earned
              in one month are paid out the following month.
            </TermsPoint>
            <TermsPoint>
              A referral stays attributed to you for {terms.attribution} after
              they first arrive through your link.
            </TermsPoint>
            <TermsPoint>
              Commission does not start accruing until{" "}
              {terms.newCustomerPeriodDays} days after you begin referring. That
              waiting period is separate from the attribution window.
            </TermsPoint>
          </ul>
        </div>
      }
    >
      <SetupListRow
        mark="A"
        markClass="bg-[var(--module-academy-bg)] text-[var(--module-academy-fg)]"
        title="Academy"
        detail={`${terms.academy} commission, ${terms.attribution} attribution window`}
      />
      <SetupListRow
        mark="P"
        markClass="bg-[var(--module-whitby-bg)] text-[var(--module-whitby-fg)]"
        title="Whitby"
        detail={`${terms.platform} commission, ${terms.attribution} attribution window`}
      />
      <SetupListRow
        mark="E"
        markClass="bg-[var(--module-partner-bg)] text-[var(--module-partner-fg)]"
        title="Enterprise"
        detail={
          enterpriseOn
            ? `${terms.enterprise}, custom terms`
            : "Not yet enrolled. Custom terms by request."
        }
        last
      />
    </ConfirmContinueScreen>
  );
}

const GUIDE_ROWS = [
  {
    mark: "1",
    title: "How referrals work",
    detail: "Share your Partner Center link. Attribution follows the program window.",
  },
  {
    mark: "2",
    title: "What you can share",
    detail: "Public program information, your own rates, and approved collateral.",
  },
  {
    mark: "3",
    title: "What you cannot share",
    detail: "Client files, internal pricing exceptions, or unpublished product details.",
  },
  {
    mark: "4",
    title: "Payouts vs referring",
    detail: "You can refer immediately. Payouts wait until tax and payout setup are complete.",
  },
  {
    mark: "5",
    title: "Support",
    detail: "Partner questions go to Private Attaché program support, not the client desk.",
  },
];

export function PartnerGuideScreen({
  companyName,
  readOnly = false,
}: {
  companyName: string;
  readOnly?: boolean;
}) {
  return (
    <ConfirmContinueScreen
      title="Partner guide & policies"
      description={`A short read for ${companyName} before you start referring.`}
      onConfirm={confirmPartnerGuide}
      nextFallback={PARTNER_PATHS.checklist}
      readOnly={readOnly}
    >
      {GUIDE_ROWS.map((row, index) => (
        <SetupListRow
          key={row.title}
          mark={row.mark}
          markClass="bg-[var(--surface-soft)] text-ink"
          title={row.title}
          detail={row.detail}
          last={index === GUIDE_ROWS.length - 1}
        />
      ))}
    </ConfirmContinueScreen>
  );
}
