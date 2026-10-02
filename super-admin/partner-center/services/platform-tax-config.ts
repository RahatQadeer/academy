import type { SupabaseClient } from "@supabase/supabase-js";
import { writePartnerAdminAudit } from "@/super-admin/partner-center/lib/admin-audit";

export type PayoutMethodOption =
  | "stripe_connect"
  | "quickbooks"
  | "ach"
  | "check";

export type PlatformTaxConfig = {
  id: string;
  legalPayerEntity: string;
  availablePayoutMethods: PayoutMethodOption[];
  taxFormType: "w9" | "w8" | "other";
  taxCollectionSource: "stripe_tax" | "quickbooks_w9" | "other";
};

export type PlatformTaxConfigInput = {
  legalPayerEntity: string;
  availablePayoutMethods: PayoutMethodOption[];
  taxFormType: "w9" | "w8" | "other";
  taxCollectionSource: "stripe_tax" | "quickbooks_w9" | "other";
};

const ALL_METHODS: PayoutMethodOption[] = [
  "stripe_connect",
  "quickbooks",
  "ach",
  "check",
];

const DEFAULTS: Omit<PlatformTaxConfig, "id"> = {
  legalPayerEntity: "Private Attache",
  availablePayoutMethods: ["stripe_connect", "quickbooks"],
  taxFormType: "w9",
  taxCollectionSource: "stripe_tax",
};

function normalizeMethods(raw: unknown): PayoutMethodOption[] {
  const list = Array.isArray(raw) ? raw : [];
  const filtered = list.filter((item): item is PayoutMethodOption =>
    ALL_METHODS.includes(item as PayoutMethodOption),
  );
  return filtered.length > 0 ? filtered : [...DEFAULTS.availablePayoutMethods];
}

export async function loadPlatformTaxConfig(
  admin: SupabaseClient,
): Promise<PlatformTaxConfig> {
  const { data } = await admin
    .from("partner_platform_tax_config")
    .select(
      "id, legal_payer_entity, available_payout_methods, tax_form_type, tax_collection_source",
    )
    .limit(1)
    .maybeSingle();

  if (!data) {
    return { id: "", ...DEFAULTS };
  }

  return {
    id: data.id as string,
    legalPayerEntity:
      ((data.legal_payer_entity as string | null) ?? "").trim() ||
      DEFAULTS.legalPayerEntity,
    availablePayoutMethods: normalizeMethods(data.available_payout_methods),
    taxFormType:
      (data.tax_form_type as PlatformTaxConfig["taxFormType"]) ||
      DEFAULTS.taxFormType,
    taxCollectionSource:
      (data.tax_collection_source as PlatformTaxConfig["taxCollectionSource"]) ||
      DEFAULTS.taxCollectionSource,
  };
}

export async function savePlatformTaxConfig(input: {
  admin: SupabaseClient;
  actorUserId: string | null;
} & PlatformTaxConfigInput): Promise<{ error?: string }> {
  const legal = input.legalPayerEntity.trim();
  if (!legal) {
    return { error: "Legal payer entity is required." };
  }

  const methods = normalizeMethods(input.availablePayoutMethods);
  if (methods.length === 0) {
    return { error: "Enable at least one payout method." };
  }

  const existing = await loadPlatformTaxConfig(input.admin);
  const now = new Date().toISOString();
  const payload = {
    legal_payer_entity: legal,
    available_payout_methods: methods,
    tax_form_type: input.taxFormType,
    tax_collection_source: input.taxCollectionSource,
    updated_by_user_id: input.actorUserId,
    updated_at: now,
  };

  if (existing.id) {
    const { error } = await input.admin
      .from("partner_platform_tax_config")
      .update(payload)
      .eq("id", existing.id);
    if (error) return { error: error.message };
  } else {
    const { error } = await input.admin
      .from("partner_platform_tax_config")
      .insert(payload);
    if (error) return { error: error.message };
  }

  await writePartnerAdminAudit(input.admin, {
    actorUserId: input.actorUserId,
    entityType: "partner_platform_tax_config",
    entityId: existing.id || "singleton",
    action: "platform_tax_config_saved",
    previousValue: {
      legal_payer_entity: existing.legalPayerEntity,
      available_payout_methods: existing.availablePayoutMethods,
      tax_form_type: existing.taxFormType,
      tax_collection_source: existing.taxCollectionSource,
    },
    newValue: {
      legal_payer_entity: legal,
      available_payout_methods: methods,
      tax_form_type: input.taxFormType,
      tax_collection_source: input.taxCollectionSource,
    },
  });

  return {};
}
