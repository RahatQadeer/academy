import type { SupabaseClient } from "@supabase/supabase-js";
import { writePartnerAdminAudit } from "@/super-admin/partner-center/lib/admin-audit";

export type EnterpriseProtectionRules = {
  id: string;
  acceptanceRequired: boolean;
  protectionPeriodDays: number;
  renewalExtensionNotes: string;
  conflictResolutionNotes: string;
};

const DEFAULTS: Omit<EnterpriseProtectionRules, "id"> = {
  acceptanceRequired: true,
  protectionPeriodDays: 180,
  renewalExtensionNotes: "",
  conflictResolutionNotes: "",
};

export async function loadEnterpriseProtectionRules(
  admin: SupabaseClient,
): Promise<EnterpriseProtectionRules> {
  const { data } = await admin
    .from("partner_enterprise_protection_rules")
    .select(
      "id, acceptance_required, protection_period_days, renewal_extension_notes, conflict_resolution_notes",
    )
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) {
    return { id: "", ...DEFAULTS };
  }

  return {
    id: data.id as string,
    acceptanceRequired: Boolean(data.acceptance_required),
    protectionPeriodDays:
      Number(data.protection_period_days) || DEFAULTS.protectionPeriodDays,
    renewalExtensionNotes:
      (data.renewal_extension_notes as string | null) ?? "",
    conflictResolutionNotes:
      (data.conflict_resolution_notes as string | null) ?? "",
  };
}

export async function saveEnterpriseProtectionRules(input: {
  admin: SupabaseClient;
  actorUserId: string | null;
  acceptanceRequired: boolean;
  protectionPeriodDays: number;
  renewalExtensionNotes: string;
  conflictResolutionNotes: string;
}): Promise<{ error?: string }> {
  const days = Math.floor(input.protectionPeriodDays);
  if (!Number.isFinite(days) || days < 1 || days > 3650) {
    return { error: "Protection period must be between 1 and 3650 days." };
  }

  const existing = await loadEnterpriseProtectionRules(input.admin);
  const now = new Date().toISOString();
  const payload = {
    acceptance_required: input.acceptanceRequired,
    protection_period_days: days,
    renewal_extension_notes: input.renewalExtensionNotes.trim() || null,
    conflict_resolution_notes: input.conflictResolutionNotes.trim() || null,
    updated_by_user_id: input.actorUserId,
    updated_at: now,
  };

  if (existing.id) {
    const { error } = await input.admin
      .from("partner_enterprise_protection_rules")
      .update(payload)
      .eq("id", existing.id);
    if (error) return { error: error.message };
  } else {
    const { error } = await input.admin
      .from("partner_enterprise_protection_rules")
      .insert(payload);
    if (error) return { error: error.message };
  }

  // Keep global enterprise commission rule window in sync.
  const { error: ruleError } = await input.admin
    .from("partner_commission_rules")
    .update({ attribution_window_days: days })
    .is("partner_profile_id", null)
    .eq("program", "enterprise");

  if (ruleError) return { error: ruleError.message };

  if (existing.id) {
    const audit = await writePartnerAdminAudit(input.admin, {
      actorUserId: input.actorUserId,
      entityType: "partner_enterprise_protection_rules",
      entityId: existing.id,
      action: "save_protection_rules",
      previousValue: existing,
      newValue: {
        acceptanceRequired: input.acceptanceRequired,
        protectionPeriodDays: days,
        renewalExtensionNotes: input.renewalExtensionNotes,
        conflictResolutionNotes: input.conflictResolutionNotes,
      },
    });
    if (audit.error) return { error: audit.error };
  }

  return {};
}
