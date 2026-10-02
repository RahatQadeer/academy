import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient, isSupabaseConfigured } from "@/base/lib/supabase/server";
import {
  DEFAULT_PRODUCT_INTEREST_OPTIONS,
  humanizeProductInterest,
  type ProductInterestOption,
} from "@/partner-center/opportunities/lib/product-interest-shared";

export type { ProductInterestOption };
export {
  DEFAULT_PRODUCT_INTEREST_OPTIONS,
  humanizeProductInterest,
  isValidProductInterestValue,
  parseProductInterests,
  resolveSubmittedProductInterests,
  serializeProductInterests,
  slugifyProductInterestLabel,
} from "@/partner-center/opportunities/lib/product-interest-shared";

function mapRows(
  rows: Array<Record<string, unknown>>,
): ProductInterestOption[] {
  return rows
    .map((row) => ({
      value: String(row.value ?? ""),
      label: String(row.label ?? ""),
      sortOrder: Number(row.sort_order) || 0,
      active: Boolean(row.active),
    }))
    .filter((row) => row.value && row.label)
    .sort(
      (a, b) =>
        a.sortOrder - b.sortOrder || a.label.localeCompare(b.label),
    );
}

export async function loadProductInterestOptions(
  supabase?: SupabaseClient | null,
  opts?: { activeOnly?: boolean; includeValues?: string[] },
): Promise<ProductInterestOption[]> {
  const activeOnly = opts?.activeOnly !== false;
  const includeValues = new Set(
    (opts?.includeValues ?? []).map((v) => v.trim()).filter(Boolean),
  );

  let client = supabase ?? null;
  if (!client) {
    if (!isSupabaseConfigured()) {
      return DEFAULT_PRODUCT_INTEREST_OPTIONS.filter((o) => o.active);
    }
    client = await createClient();
  }

  const { data, error } = await client
    .from("partner_opportunity_product_interests")
    .select("value, label, sort_order, active")
    .order("sort_order", { ascending: true });

  // Partner forms use the fixed Academy / Whitby / Enterprise set (multi-select).
  // Full DB list (incl. inactive legacy) is for Admin config + historical labels.
  if (activeOnly) {
    const defaults = DEFAULT_PRODUCT_INTEREST_OPTIONS.filter((o) => o.active);
    if (includeValues.size === 0) return defaults;
    return mergeIncluded(defaults, includeValues);
  }

  if (error || !data || data.length === 0) {
    return mergeIncluded(
      DEFAULT_PRODUCT_INTEREST_OPTIONS.filter((o) => o.active),
      includeValues,
    );
  }

  const options = mapRows(data as Array<Record<string, unknown>>);
  if (options.length === 0) {
    return mergeIncluded(
      DEFAULT_PRODUCT_INTEREST_OPTIONS.filter((o) => o.active),
      includeValues,
    );
  }

  return mergeIncluded(options, includeValues);
}

function mergeIncluded(
  options: ProductInterestOption[],
  includeValues: Set<string>,
): ProductInterestOption[] {
  if (includeValues.size === 0) return options;
  const known = new Set(options.map((o) => o.value));
  const extras: ProductInterestOption[] = [];
  for (const value of includeValues) {
    if (known.has(value)) continue;
    extras.push({
      value,
      label: humanizeProductInterest(value),
      sortOrder: 10_000,
      active: false,
    });
  }
  return [...options, ...extras];
}
