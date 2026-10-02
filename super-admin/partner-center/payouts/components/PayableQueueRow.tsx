"use client";

import Link from "next/link";
import { useState } from "react";
import { resolvePayoutGate } from "@/partner-center/lib/payout-gate";
import { IssueManualRailPayoutButton } from "@/super-admin/partner-center/payouts/components/IssueManualRailPayoutButton";
import { IssueQuickBooksPayoutButton } from "@/super-admin/partner-center/payouts/components/IssueQuickBooksPayoutButton";
import { RunPayoutButton } from "@/super-admin/partner-center/payouts/components/RunPayoutButton";
import type { EnabledPayoutMethods } from "@/super-admin/partner-center/payouts/lib/filter-payable";
import { useAdminUiPaths, useAdminUiMode } from "@/super-admin/partner-center/lib/admin-ui-paths";
import type { PayablePartnerListItem } from "@/super-admin/partner-center/types";

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value);
}

export function PayableQueueRow({
  item,
  enabled,
  readOnly = false,
}: {
  item: PayablePartnerListItem;
  enabled: EnabledPayoutMethods;
  readOnly?: boolean;
}) {
  const paths = useAdminUiPaths();
  const mode = useAdminUiMode();
  const viewOnly = readOnly || mode === "partner_admin";
  const [open, setOpen] = useState(false);

  const gate = resolvePayoutGate({
    payout_eligibility: item.payoutEligibility,
    tax_profile_status: item.taxProfileStatus,
    payment_setup_status: item.paymentSetupStatus,
  });
  const canStripe =
    enabled.stripeEnabled &&
    gate === "eligible" &&
    item.stripeConnected &&
    item.payableTotal > 0;
  const canQb =
    enabled.quickbooksEnabled &&
    gate === "eligible" &&
    item.payableTotal > 0;
  const canAch =
    enabled.achEnabled && gate === "eligible" && item.payableTotal > 0;
  const canCheck =
    enabled.checkEnabled && gate === "eligible" && item.payableTotal > 0;
  const preferred = item.preferredPayoutMethod;
  const hasAnyMethod =
    enabled.stripeEnabled ||
    enabled.quickbooksEnabled ||
    enabled.achEnabled ||
    enabled.checkEnabled;
  const stripeLabel = item.stripeConnected ? " · Stripe ready" : "";
  return (
    <>
      <tr
        role="button"
        tabIndex={0}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            setOpen((value) => !value);
          }
        }}
        className="cursor-pointer"
        style={{
          borderBottom: open ? undefined : "1px solid var(--border)",
          background: open ? "rgba(35,131,226,0.04)" : undefined,
        }}
      >
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            <span
              className="inline-block w-3 text-[11.5px]"
              style={{ color: "var(--text-tertiary)" }}
              aria-hidden
            >
              {open ? "▾" : "▸"}
            </span>
            <Link
              href={paths.partner(item.id)}
              className="font-medium no-underline"
              style={{ color: "var(--ink)" }}
              onClick={(event) => event.stopPropagation()}
            >
              {item.companyName}
            </Link>
          </div>
        </td>
        <td className="px-4 py-3 font-medium">
          {formatMoney(item.payableTotal)}
        </td>
        <td className="px-4 py-3" style={{ color: "var(--text-secondary)" }}>
          {item.payableCount}
        </td>
        <td className="px-4 py-3" style={{ color: "var(--text-secondary)" }}>
          {item.taxProfileStatus.replace(/_/g, " ")}
        </td>
        <td className="px-4 py-3" style={{ color: "var(--text-secondary)" }}>
          {(preferred || "—").replace(/_/g, " ")}
          {stripeLabel}
        </td>
        <td className="px-4 py-3" style={{ color: "var(--text-secondary)" }}>
          {gate.replace(/_/g, " ")}
        </td>
      </tr>
      {open ? (
        <tr style={{ borderBottom: "1px solid var(--border)" }}>
          <td colSpan={6} className="px-4 py-4" onClick={(e) => e.stopPropagation()}>
            {viewOnly ? (
              <p
                className="m-0 text-[12.5px]"
                style={{ color: "var(--text-secondary)" }}
              >
                Payout actions are Super Admin only. Partner Admin can review
                eligibility here.
              </p>
            ) : (
              <>
                <p
                  className="m-0 mb-3 text-[12.5px] font-semibold"
                  style={{ color: "var(--text-tertiary)" }}
                >
                  Payout actions
                </p>
                <div className="flex max-w-md flex-col gap-3">
                  {enabled.stripeEnabled ? (
                    <RunPayoutButton
                      partnerProfileId={item.id}
                      disabled={!canStripe}
                    />
                  ) : null}
                  {enabled.quickbooksEnabled ? (
                    <IssueQuickBooksPayoutButton
                      partnerProfileId={item.id}
                      disabled={!canQb}
                      needsOverride={preferred !== "quickbooks"}
                    />
                  ) : null}
                  {enabled.achEnabled ? (
                    <IssueManualRailPayoutButton
                      partnerProfileId={item.id}
                      method="ach"
                      disabled={!canAch}
                      needsOverride={preferred !== "ach"}
                    />
                  ) : null}
                  {enabled.checkEnabled ? (
                    <IssueManualRailPayoutButton
                      partnerProfileId={item.id}
                      method="check"
                      disabled={!canCheck}
                      needsOverride={preferred !== "check"}
                    />
                  ) : null}
                  {!hasAnyMethod ? (
                    <span
                      className="text-[12.5px]"
                      style={{ color: "var(--text-tertiary)" }}
                    >
                      No methods enabled
                    </span>
                  ) : null}
                </div>
              </>
            )}
          </td>
        </tr>
      ) : null}
    </>
  );
}
