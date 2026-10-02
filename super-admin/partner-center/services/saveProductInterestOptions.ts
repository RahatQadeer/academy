import type { SupabaseClient } from "@supabase/supabase-js";
import { writePartnerAdminAudit } from "@/super-admin/partner-center/lib/admin-audit";
import {
  DEFAULT_PRODUCT_INTEREST_OPTIONS,
  isValidProductInterestValue,
  type ProductInterestOption,
} from "@/partner-center/opportunities/lib/product-interest-options";

export type AdminProductInterestOption = ProductInterestOption & {
  id: string;
};

export async function loadAdminProductInterestOptions(
  admin: SupabaseClient,
): Promise<AdminProductInterestOption[]> {
  const { data, error } = await admin
    .from("partner_opportunity_product_interests")
    .select("id, value, label, sort_order, active")
    .order("sort_order", { ascending: true });

  if (error || !data || data.length === 0) {
    return DEFAULT_PRODUCT_INTEREST_OPTIONS.map((option, index) => ({
      id: `default-${option.value}`,
      ...option,
      sortOrder: option.sortOrder || (index + 1) * 10,
    }));
  }

  return (data as Array<Record<string, unknown>>).map((row) => ({
    id: String(row.id),
    value: String(row.value ?? ""),
    label: String(row.label ?? ""),
    sortOrder: Number(row.sort_order) || 0,
    active: Boolean(row.active),
  }));
}

export type SaveProductInterestOptionInput = {
  id?: string;
  value: string;
  label: string;
  sortOrder: number;
  active: boolean;
};

export async function saveProductInterestOptions(input: {
  admin: SupabaseClient;
  actorUserId: string | null;
  options: SaveProductInterestOptionInput[];
}): Promise<{ error?: string }> {
  if (input.options.length === 0) {
    return { error: "Add at least one product interest option." };
  }

  const normalized: SaveProductInterestOptionInput[] = [];
  const seen = new Set<string>();

  for (const option of input.options) {
    const value = option.value.trim().toLowerCase();
    const label = option.label.trim();
    if (!label) return { error: "Every option needs a label." };
    if (!isValidProductInterestValue(value)) {
      return {
        error: `Invalid value "${option.value}". Use lowercase letters, numbers, and underscores (start with a letter).`,
      };
    }
    if (seen.has(value)) {
      return { error: `Duplicate value "${value}".` };
    }
    seen.add(value);
    const sortOrder = Math.floor(Number(option.sortOrder));
    if (!Number.isFinite(sortOrder) || sortOrder < 0 || sortOrder > 100_000) {
      return { error: "Sort order must be a number between 0 and 100000." };
    }
    normalized.push({
      id: option.id?.startsWith("default-") ? undefined : option.id,
      value,
      label,
      sortOrder,
      active: Boolean(option.active),
    });
  }

  if (!normalized.some((option) => option.active)) {
    return { error: "Keep at least one active product interest option." };
  }

  const previous = await loadAdminProductInterestOptions(input.admin);
  const previousIds = new Set(
    previous
      .map((row) => row.id)
      .filter((id) => !id.startsWith("default-")),
  );
  const keepIds = new Set(
    normalized
      .map((row) => row.id)
      .filter((id): id is string => Boolean(id)),
  );

  const toDelete = [...previousIds].filter((id) => !keepIds.has(id));
  if (toDelete.length > 0) {
    const { error } = await input.admin
      .from("partner_opportunity_product_interests")
      .delete()
      .in("id", toDelete);
    if (error) return { error: error.message };
  }

  const now = new Date().toISOString();
  for (const option of normalized) {
    const payload = {
      value: option.value,
      label: option.label,
      sort_order: option.sortOrder,
      active: option.active,
      updated_at: now,
    };

    if (option.id) {
      const { error } = await input.admin
        .from("partner_opportunity_product_interests")
        .update(payload)
        .eq("id", option.id);
      if (error) return { error: error.message };
    } else {
      const { error } = await input.admin
        .from("partner_opportunity_product_interests")
        .insert(payload);
      if (error) return { error: error.message };
    }
  }

  const audit = await writePartnerAdminAudit(input.admin, {
    actorUserId: input.actorUserId,
    entityType: "partner_opportunity_product_interests",
    entityId: normalized[0]?.id ?? normalized[0]?.value ?? "config",
    action: "save_product_interest_options",
    previousValue: {
      options: previous.map((row) => ({
        value: row.value,
        label: row.label,
        sortOrder: row.sortOrder,
        active: row.active,
      })),
    },
    newValue: {
      options: normalized.map((row) => ({
        value: row.value,
        label: row.label,
        sortOrder: row.sortOrder,
        active: row.active,
      })),
    },
  });

  if (audit.error) return { error: audit.error };
  return {};
}
