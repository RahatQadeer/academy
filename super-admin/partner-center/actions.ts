"use server";

import { revalidatePath } from "next/cache";
import type { PartnerProgramFamily } from "@/partner-center/types/application";
import { adminWriter } from "@/super-admin/partner-center/lib/admin-writer";
import { PC_ADMIN } from "@/super-admin/partner-center/lib/paths";
import { approveApplication } from "@/super-admin/partner-center/services/approveApplication";
import { declineApplication } from "@/super-admin/partner-center/services/declineApplication";
import { requestApplicationInfo } from "@/super-admin/partner-center/services/requestApplicationInfo";
import {
  type OpportunityAdminAction,
  updateOpportunityStatus,
} from "@/super-admin/partner-center/services/updateOpportunityStatus";
import { promoteEarningsToPayable } from "@/partner-center/lib/attribution/promote-payable";
import { recordOpportunityPayment } from "@/partner-center/lib/attribution/record-opportunity-payment";
import { verifyCollectedPayment } from "@/partner-center/lib/attribution/verify-collected-payment";
import {
  validateStripeOpportunityPayment,
} from "@/super-admin/partner-center/opportunities/lib/validate-stripe-opportunity-payment";
import type { ValidateStripeOpportunityPaymentResult } from "@/super-admin/partner-center/opportunities/lib/validate-stripe-opportunity-payment-types";
import { runStripePayoutForPartner } from "@/partner-center/lib/payouts";
import { issueQuickBooksPayout } from "@/partner-center/lib/payouts/issue-quickbooks-payout";
import { disconnectQuickBooks } from "@/partner-center/lib/quickbooks/credentials";
import {
  savePlatformTaxConfig,
  type PlatformTaxConfigInput,
} from "@/super-admin/partner-center/services/platform-tax-config";
import {
  savePlatformAttributionConfig,
  type PlatformAttributionConfigInput,
} from "@/super-admin/partner-center/services/platform-attribution-config";
import {
  saveGlobalCommissionRule,
  type GlobalCommissionRuleInput,
} from "@/super-admin/partner-center/services/saveCommissionDefaults";
import { savePartnerProgramsAndTerms } from "@/super-admin/partner-center/services/savePartnerProgramsAndTerms";
import type { PartnerProgramsAndTermsInput } from "@/super-admin/partner-center/services/savePartnerProgramsAndTerms";
import { issueManualRailPayout } from "@/partner-center/lib/payouts/issue-manual-rail-payout";
import {
  generate1099Rollups,
  update1099RollupStatus,
} from "@/partner-center/lib/tax/rollup-1099";
import { correctReferralAttribution } from "@/super-admin/partner-center/services/correctReferralAttribution";
import { correctOpportunityAttribution } from "@/super-admin/partner-center/services/correctOpportunityAttribution";
import { extendOpportunityProtection } from "@/super-admin/partner-center/services/extendOpportunityProtection";
import { createAdminReferral } from "@/super-admin/partner-center/services/createAdminReferral";
import { writePartnerAdminAudit } from "@/super-admin/partner-center/lib/admin-audit";
import { saveEnterpriseProtectionRules } from "@/super-admin/partner-center/services/saveEnterpriseProtectionRules";
import {
  saveProductInterestOptions,
  type SaveProductInterestOptionInput,
} from "@/super-admin/partner-center/services/saveProductInterestOptions";

type ActionResult = { error?: string; ok?: boolean };

function revalidateApplication(profileId: string) {
  revalidatePath(PC_ADMIN.applications);
  revalidatePath(PC_ADMIN.application(profileId));
  revalidatePath(PC_ADMIN.partners);
  revalidatePath(PC_ADMIN.partner(profileId));
}

function revalidateOpportunity(opportunityId: string) {
  revalidatePath(PC_ADMIN.opportunities);
  revalidatePath(PC_ADMIN.opportunity(opportunityId));
}

function revalidateReferral(referralId: string) {
  revalidatePath(PC_ADMIN.referrals);
  revalidatePath(PC_ADMIN.referral(referralId));
}

export async function approveApplicationAction(input: {
  profileId: string;
  programs: PartnerProgramFamily[];
}): Promise<ActionResult> {
  const loaded = await adminWriter();
  if ("error" in loaded) return { error: loaded.error };

  const result = await approveApplication({
    admin: loaded.admin,
    actorUserId: loaded.actorUserId,
    profileId: input.profileId,
    programs: input.programs,
  });

  if (result.error) return { error: result.error };
  revalidateApplication(input.profileId);
  return { ok: true };
}

export async function declineApplicationAction(input: {
  profileId: string;
  reason: string;
}): Promise<ActionResult> {
  const loaded = await adminWriter();
  if ("error" in loaded) return { error: loaded.error };

  const result = await declineApplication({
    admin: loaded.admin,
    actorUserId: loaded.actorUserId,
    profileId: input.profileId,
    reason: input.reason,
  });

  if (result.error) return { error: result.error };
  revalidateApplication(input.profileId);
  return { ok: true };
}

export async function requestApplicationInfoAction(input: {
  profileId: string;
  message: string;
}): Promise<ActionResult> {
  const loaded = await adminWriter();
  if ("error" in loaded) return { error: loaded.error };

  const result = await requestApplicationInfo({
    admin: loaded.admin,
    actorUserId: loaded.actorUserId,
    profileId: input.profileId,
    message: input.message,
  });

  if (result.error) return { error: result.error };
  revalidateApplication(input.profileId);
  return { ok: true };
}

export async function updateOpportunityStatusAction(input: {
  opportunityId: string;
  action: OpportunityAdminAction;
}): Promise<ActionResult> {
  const loaded = await adminWriter();
  if ("error" in loaded) return { error: loaded.error };

  const result = await updateOpportunityStatus({
    admin: loaded.admin,
    actorUserId: loaded.actorUserId,
    opportunityId: input.opportunityId,
    action: input.action,
  });

  if (result.error) return { error: result.error };
  revalidateOpportunity(input.opportunityId);
  revalidatePath(`/partner-center/opportunities/${input.opportunityId}`);
  revalidatePath("/partner-center", "layout");
  return { ok: true };
}

export async function validateOpportunityStripePaymentAction(input: {
  opportunityId: string;
  paymentId: string;
}): Promise<ValidateStripeOpportunityPaymentResult> {
  const loaded = await adminWriter();
  if ("error" in loaded) return { ok: false, error: loaded.error };

  try {
    return await validateStripeOpportunityPayment(loaded.admin, {
      opportunityId: input.opportunityId,
      paymentId: input.paymentId,
    });
  } catch (error) {
    console.error("[validateOpportunityStripePaymentAction]", error);
    return { ok: false, error: "Could not validate payment." };
  }
}

export async function recordOpportunityPaymentAction(input: {
  opportunityId: string;
  paymentId: string;
  paymentDate?: string;
  eventSource?: "stripe" | "quickbooks";
}): Promise<ActionResult & { message?: string }> {
  const loaded = await adminWriter();
  if ("error" in loaded) return { error: loaded.error };

  const eventSource =
    input.eventSource === "quickbooks" ? "quickbooks" : "stripe";

  const paymentDate = input.paymentDate?.trim() || undefined;
  if (paymentDate) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(paymentDate)) {
      return { error: "Payment date must be a valid calendar day." };
    }
    // Date-only field is local on the client; allow +1 UTC day so a local
    // "today" near a timezone boundary is not rejected as future.
    const utcToday = new Date().toISOString().slice(0, 10);
    const skew = new Date(`${utcToday}T12:00:00.000Z`);
    skew.setUTCDate(skew.getUTCDate() + 1);
    const maxAllowed = skew.toISOString().slice(0, 10);
    if (paymentDate > maxAllowed) {
      return { error: "Payment date cannot be in the future." };
    }
  }

  try {
    let externalPaymentId: string;
    let amountCollectedCents: number;
    let eventTimestamp: string;

    if (eventSource === "stripe") {
      const validated = await validateStripeOpportunityPayment(loaded.admin, {
        opportunityId: input.opportunityId,
        paymentId: input.paymentId,
      });
      if (!validated.ok) {
        return { error: validated.error };
      }

      const verified = await verifyCollectedPayment(loaded.admin, {
        eventSource: "stripe",
        paymentId: validated.resolvedPaymentId,
      });
      if (!verified.ok) {
        return { error: verified.error };
      }

      if (
        verified.payment.amountCollectedCents !== validated.amountCollectedCents
      ) {
        return {
          error:
            "Validated invoice amount does not match the Stripe payment amount. Payment was not recorded.",
        };
      }

      if (verified.payment.externalPaymentId !== validated.resolvedPaymentId) {
        return {
          error:
            "Validated payment id does not match Stripe lookup. Payment was not recorded.",
        };
      }

      externalPaymentId = validated.resolvedPaymentId;
      amountCollectedCents = validated.amountCollectedCents;
      eventTimestamp = paymentDate
        ? `${paymentDate}T12:00:00.000Z`
        : validated.eventTimestamp;
    } else {
      const verified = await verifyCollectedPayment(loaded.admin, {
        eventSource,
        paymentId: input.paymentId,
      });
      if (!verified.ok) {
        return { error: verified.error };
      }

      externalPaymentId = verified.payment.externalPaymentId;
      amountCollectedCents = verified.payment.amountCollectedCents;
      eventTimestamp = paymentDate
        ? `${paymentDate}T12:00:00.000Z`
        : verified.payment.eventTimestamp;
    }

    const result = await recordOpportunityPayment(loaded.admin, {
      opportunityId: input.opportunityId,
      externalPaymentId,
      amountCollectedCents,
      eventSource,
      eventTimestamp,
    });

    if (!result.ok) {
      return { error: result.error ?? "Could not record payment." };
    }

    await writePartnerAdminAudit(loaded.admin, {
      actorUserId: loaded.actorUserId,
      entityType: "partner_opportunity",
      entityId: input.opportunityId,
      action: "record_payment",
      newValue: {
        externalPaymentId,
        amountCollectedCents,
        eventSource,
        eventId: result.eventId ?? null,
        earningId: result.earningId ?? null,
        skipped: result.skipped ?? false,
      },
    });

    revalidateOpportunity(input.opportunityId);
    revalidatePath(PC_ADMIN.payouts);

    if (result.skipped) {
      return {
        ok: true,
        message: result.reason ?? "Payment was already recorded.",
      };
    }

    const amountLabel = (amountCollectedCents / 100).toLocaleString("en-US", {
      style: "currency",
      currency: "USD",
    });

    return {
      ok: true,
      message: result.earningId
        ? `Payment ${externalPaymentId} (${amountLabel}) recorded and enterprise earning created.`
        : `Payment ${externalPaymentId} (${amountLabel}) recorded.`,
    };
  } catch (error) {
    console.error("[recordOpportunityPaymentAction]", error);
    return { error: "Could not record payment." };
  }
}

export async function correctReferralAttributionAction(input: {
  referralId: string;
  newPartnerProfileId: string;
  reason: string;
}): Promise<ActionResult & { message?: string }> {
  const loaded = await adminWriter();
  if ("error" in loaded) return { error: loaded.error };

  const result = await correctReferralAttribution({
    admin: loaded.admin,
    actorUserId: loaded.actorUserId,
    referralId: input.referralId,
    newPartnerProfileId: input.newPartnerProfileId,
    reason: input.reason,
  });

  if (result.error) return { error: result.error };

  revalidateReferral(input.referralId);
  revalidatePath(PC_ADMIN.partners);
  return { ok: true, message: "Attribution corrected." };
}

export async function correctOpportunityAttributionAction(input: {
  opportunityId: string;
  newPartnerProfileId: string;
  reason: string;
}): Promise<ActionResult & { message?: string }> {
  const loaded = await adminWriter();
  if ("error" in loaded) return { error: loaded.error };

  const result = await correctOpportunityAttribution({
    admin: loaded.admin,
    actorUserId: loaded.actorUserId,
    opportunityId: input.opportunityId,
    newPartnerProfileId: input.newPartnerProfileId,
    reason: input.reason,
  });

  if (result.error) return { error: result.error };

  revalidateOpportunity(input.opportunityId);
  revalidatePath(PC_ADMIN.partners);
  return { ok: true, message: "Attribution corrected." };
}

export async function extendOpportunityProtectionAction(input: {
  opportunityId: string;
  protectedUntil: string;
  reason: string;
}): Promise<ActionResult & { message?: string }> {
  const loaded = await adminWriter();
  if ("error" in loaded) return { error: loaded.error };

  const result = await extendOpportunityProtection({
    admin: loaded.admin,
    actorUserId: loaded.actorUserId,
    opportunityId: input.opportunityId,
    protectedUntil: input.protectedUntil,
    reason: input.reason,
  });

  if (result.error) return { error: result.error };
  revalidateOpportunity(input.opportunityId);
  return { ok: true, message: "Protection extended." };
}

export async function saveEnterpriseProtectionRulesAction(input: {
  acceptanceRequired: boolean;
  protectionPeriodDays: number;
  renewalExtensionNotes: string;
  conflictResolutionNotes: string;
}): Promise<ActionResult & { message?: string }> {
  const loaded = await adminWriter();
  if ("error" in loaded) return { error: loaded.error };

  const result = await saveEnterpriseProtectionRules({
    admin: loaded.admin,
    actorUserId: loaded.actorUserId,
    ...input,
  });

  if (result.error) return { error: result.error };
  revalidatePath(PC_ADMIN.programConfig);
  revalidatePath(PC_ADMIN.opportunities);
  return { ok: true, message: "Enterprise protection rules saved." };
}

export async function saveProductInterestOptionsAction(input: {
  options: SaveProductInterestOptionInput[];
}): Promise<ActionResult & { message?: string }> {
  const loaded = await adminWriter();
  if ("error" in loaded) return { error: loaded.error };

  const result = await saveProductInterestOptions({
    admin: loaded.admin,
    actorUserId: loaded.actorUserId,
    options: input.options,
  });

  if (result.error) return { error: result.error };
  revalidatePath(PC_ADMIN.programConfig);
  revalidatePath("/partner-center/opportunities");
  revalidatePath("/partner-center/opportunities/new");
  return { ok: true, message: "Product interest options saved." };
}

export async function createAdminReferralAction(input: {
  partnerProfileId: string;
  program: "academy" | "whitbyos";
  reason: string;
  referredUserId?: string;
  email?: string;
  fullName?: string;
}): Promise<ActionResult & { message?: string; referralId?: string }> {
  const loaded = await adminWriter();
  if ("error" in loaded) return { error: loaded.error };

  const result = await createAdminReferral({
    admin: loaded.admin,
    actorUserId: loaded.actorUserId,
    partnerProfileId: input.partnerProfileId,
    program: input.program,
    reason: input.reason,
    referredUserId: input.referredUserId,
    email: input.email,
    fullName: input.fullName,
  });

  if (result.error) return { error: result.error };
  if (!result.referralId) return { error: "Referral was not created." };

  revalidateReferral(result.referralId);
  revalidatePath(PC_ADMIN.partners);
  return {
    ok: true,
    referralId: result.referralId,
    message: "Referral created.",
  };
}

export async function runPartnerPayoutAction(input: {
  partnerProfileId: string;
}): Promise<ActionResult & { message?: string }> {
  const loaded = await adminWriter();
  if ("error" in loaded) return { error: loaded.error };

  await promoteEarningsToPayable(loaded.admin, input.partnerProfileId);
  const result = await runStripePayoutForPartner(
    loaded.admin,
    input.partnerProfileId,
  );

  if (!result.ok) {
    return { error: result.error ?? "Payout failed." };
  }

  revalidatePath(PC_ADMIN.payouts);
  revalidatePath(PC_ADMIN.root);

  if (result.skipped) {
    return { ok: true, message: result.reason ?? "Payout skipped." };
  }

  return { ok: true, message: `Paid $${result.amount?.toFixed(2) ?? "0.00"}.` };
}

export async function disconnectQuickBooksAction(): Promise<
  ActionResult & { message?: string }
> {
  const loaded = await adminWriter();
  if ("error" in loaded) return { error: loaded.error };

  const previous = await loaded.admin
    .from("partner_integration_credentials")
    .select("status, realm_id, connected_account, scopes")
    .eq("provider", "quickbooks")
    .maybeSingle();

  const result = await disconnectQuickBooks(
    loaded.admin,
    loaded.actorUserId,
  );
  if (result.error) return { error: result.error };

  await writePartnerAdminAudit(loaded.admin, {
    actorUserId: loaded.actorUserId,
    entityType: "partner_integration_credentials",
    entityId: "quickbooks",
    action: "quickbooks_disconnected",
    previousValue: (previous.data as Record<string, unknown> | null) ?? null,
    newValue: { status: "disconnected" },
  });

  revalidatePath(PC_ADMIN.programConfig);
  return { ok: true, message: "QuickBooks disconnected." };
}

export async function savePlatformTaxConfigAction(
  input: PlatformTaxConfigInput,
): Promise<ActionResult & { message?: string }> {
  const loaded = await adminWriter();
  if ("error" in loaded) return { error: loaded.error };

  const result = await savePlatformTaxConfig({
    admin: loaded.admin,
    actorUserId: loaded.actorUserId,
    ...input,
  });
  if (result.error) return { error: result.error };

  revalidatePath(PC_ADMIN.programConfig);
  revalidatePath(PC_ADMIN.payouts);
  return { ok: true, message: "Platform tax & payout config saved." };
}

export async function savePlatformAttributionConfigAction(
  input: PlatformAttributionConfigInput,
): Promise<ActionResult & { message?: string }> {
  const loaded = await adminWriter();
  if ("error" in loaded) return { error: loaded.error };

  const result = await savePlatformAttributionConfig({
    admin: loaded.admin,
    actorUserId: loaded.actorUserId,
    ...input,
  });
  if (result.error) return { error: result.error };

  revalidatePath(PC_ADMIN.programConfig);
  return { ok: true, message: "Attribution config saved." };
}

export async function saveGlobalCommissionRuleAction(
  input: GlobalCommissionRuleInput,
): Promise<ActionResult & { message?: string }> {
  const loaded = await adminWriter();
  if ("error" in loaded) return { error: loaded.error };

  const result = await saveGlobalCommissionRule({
    admin: loaded.admin,
    actorUserId: loaded.actorUserId,
    rule: input,
  });
  if (result.error) return { error: result.error };

  revalidatePath(PC_ADMIN.programConfig);
  return { ok: true, message: "Commission defaults saved." };
}

export async function savePartnerProgramsAndTermsAction(
  input: PartnerProgramsAndTermsInput,
): Promise<ActionResult & { message?: string }> {
  const loaded = await adminWriter();
  if ("error" in loaded) return { error: loaded.error };

  const result = await savePartnerProgramsAndTerms({
    admin: loaded.admin,
    actorUserId: loaded.actorUserId,
    ...input,
  });
  if (result.error) return { error: result.error };

  revalidatePath(PC_ADMIN.partner(input.partnerProfileId));
  revalidatePath(PC_ADMIN.partners);
  revalidatePath(PC_ADMIN.partnerTerms(input.partnerProfileId));
  return { ok: true, message: "Programs & terms saved." };
}

export async function issueManualRailPayoutAction(input: {
  partnerProfileId: string;
  method: "ach" | "check";
  reference: string;
  overrideReason?: string;
}): Promise<ActionResult & { message?: string }> {
  const loaded = await adminWriter();
  if ("error" in loaded) return { error: loaded.error };

  await promoteEarningsToPayable(loaded.admin, input.partnerProfileId);
  const result = await issueManualRailPayout(loaded.admin, {
    partnerProfileId: input.partnerProfileId,
    method: input.method,
    reference: input.reference,
    actorUserId: loaded.actorUserId,
    overrideReason: input.overrideReason,
  });

  if (!result.ok) {
    return { error: result.error ?? "Payout failed." };
  }

  revalidatePath(PC_ADMIN.payouts);
  revalidatePath(PC_ADMIN.root);

  if (result.skipped) {
    return { ok: true, message: result.reason ?? "Payout skipped." };
  }

  const label = input.method === "ach" ? "ACH" : "Check";
  return {
    ok: true,
    message: `Recorded ${label} payout $${result.amount?.toFixed(2) ?? "0.00"}.`,
  };
}

export async function issueQuickBooksPayoutAction(input: {
  partnerProfileId: string;
  reference: string;
  overrideReason?: string;
}): Promise<ActionResult & { message?: string }> {
  const loaded = await adminWriter();
  if ("error" in loaded) return { error: loaded.error };

  await promoteEarningsToPayable(loaded.admin, input.partnerProfileId);
  const result = await issueQuickBooksPayout(loaded.admin, {
    partnerProfileId: input.partnerProfileId,
    reference: input.reference,
    actorUserId: loaded.actorUserId,
    overrideReason: input.overrideReason,
  });

  if (!result.ok) {
    return { error: result.error ?? "QuickBooks payout failed." };
  }

  revalidatePath(PC_ADMIN.payouts);
  revalidatePath(PC_ADMIN.root);

  if (result.skipped) {
    return { ok: true, message: result.reason ?? "Payout skipped." };
  }

  return {
    ok: true,
    message: `Recorded QuickBooks payout $${result.amount?.toFixed(2) ?? "0.00"}.`,
  };
}

export async function generate1099RollupsAction(input: {
  taxYear: number;
}): Promise<ActionResult & { message?: string; count?: number }> {
  const loaded = await adminWriter();
  if ("error" in loaded) return { error: loaded.error };

  const result = await generate1099Rollups(loaded.admin, {
    taxYear: input.taxYear,
    actorUserId: loaded.actorUserId,
  });
  if (result.error) return { error: result.error };

  revalidatePath(PC_ADMIN.tax1099);
  return {
    ok: true,
    count: result.count,
    message: `Generated ${result.count ?? 0} rollup row(s) for ${input.taxYear}.`,
  };
}

export async function update1099RollupStatusAction(input: {
  rollupId: string;
  status: "not_started" | "in_progress" | "complete" | "filed";
  reference?: string | null;
}): Promise<ActionResult & { message?: string }> {
  const loaded = await adminWriter();
  if ("error" in loaded) return { error: loaded.error };

  const result = await update1099RollupStatus(loaded.admin, {
    ...input,
    actorUserId: loaded.actorUserId,
  });
  if (result.error) return { error: result.error };

  revalidatePath(PC_ADMIN.tax1099);
  return { ok: true, message: "Rollup updated." };
}

export async function markAdminNotificationReadAction(input: {
  notificationId: string;
}): Promise<ActionResult> {
  const loaded = await adminWriter();
  if ("error" in loaded) return { error: loaded.error };

  const staffEmail = loaded.staffEmail.trim().toLowerCase();
  if (!staffEmail) {
    return { error: "Staff session is missing an email." };
  }

  const { error } = await loaded.admin
    .from("partner_admin_notification_staff_reads")
    .upsert(
      {
        notification_id: input.notificationId,
        staff_email: staffEmail,
        read_at: new Date().toISOString(),
      },
      { onConflict: "notification_id,staff_email" },
    );

  if (error) return { error: error.message };
  revalidatePath(PC_ADMIN.root, "layout");
  return { ok: true };
}

export async function markAllAdminNotificationsReadAction(): Promise<ActionResult> {
  const loaded = await adminWriter();
  if ("error" in loaded) return { error: loaded.error };

  const staffEmail = loaded.staffEmail.trim().toLowerCase();
  if (!staffEmail) {
    return { error: "Staff session is missing an email." };
  }

  const { data: notifications, error: listError } = await loaded.admin
    .from("partner_admin_notifications")
    .select("id")
    .order("created_at", { ascending: false })
    .limit(100);

  if (listError) return { error: listError.message };
  if (!notifications?.length) return { ok: true };

  const rows = notifications.map((row) => ({
    notification_id: row.id as string,
    staff_email: staffEmail,
    read_at: new Date().toISOString(),
  }));

  const { error } = await loaded.admin
    .from("partner_admin_notification_staff_reads")
    .upsert(rows, { onConflict: "notification_id,staff_email" });

  if (error) return { error: error.message };
  revalidatePath(PC_ADMIN.root, "layout");
  return { ok: true };
}
