/** Client-safe helpers — no server/Supabase imports. */

export type ProductInterestOption = {
  value: string;
  label: string;
  sortOrder: number;
  active: boolean;
};

/**
 * Fixed product-interest choices for Enterprise Opportunities.
 * Multi-select; stored as comma-separated `product_interest` text.
 */
export const DEFAULT_PRODUCT_INTEREST_OPTIONS: ProductInterestOption[] = [
  { value: "academy", label: "Academy", sortOrder: 10, active: true },
  { value: "whitbyos", label: "Whitby", sortOrder: 20, active: true },
  { value: "enterprise", label: "Enterprise", sortOrder: 30, active: true },
];

const LEGACY_LABELS: Record<string, string> = {
  academy_seats: "Academy",
  platform_users: "Whitby",
  combined: "Academy, Whitby",
  other: "Other",
  platform: "Whitby",
};

/** Split stored product_interest (single slug or comma-separated). */
export function parseProductInterests(
  value: string | null | undefined,
): string[] {
  if (!value?.trim()) return [];
  return [
    ...new Set(
      value
        .split(",")
        .map((part) => part.trim())
        .filter(Boolean),
    ),
  ];
}

/** Stable storage form for multi-select. */
export function serializeProductInterests(values: string[]): string {
  return [
    ...new Set(values.map((v) => v.trim()).filter(Boolean)),
  ]
    .sort()
    .join(",");
}

export function humanizeProductInterest(
  value: string | null | undefined,
): string {
  if (!value) return "—";
  const parts = parseProductInterests(value);
  if (parts.length === 0) return "—";
  return parts
    .map((part) => {
      const fromDefaults = DEFAULT_PRODUCT_INTEREST_OPTIONS.find(
        (o) => o.value === part,
      );
      if (fromDefaults) return fromDefaults.label;
      if (LEGACY_LABELS[part]) return LEGACY_LABELS[part];
      return part
        .split("_")
        .filter(Boolean)
        .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
        .join(" ");
    })
    .join(", ");
}

export function isValidProductInterestValue(value: string): boolean {
  return /^[a-z][a-z0-9_]{0,63}$/.test(value);
}

/**
 * Validate multi-select against active options. Returns serialized storage value.
 */
export function resolveSubmittedProductInterests(
  raw: string | null | undefined,
  allowed: Array<{ value: string }>,
): { ok: true; value: string } | { ok: false; error: string } {
  const allowedSet = new Set(allowed.map((o) => o.value));
  const selected = parseProductInterests(raw).filter((v) => allowedSet.has(v));
  if (selected.length === 0) {
    return { ok: false, error: "Select at least one product interest." };
  }
  return { ok: true, value: serializeProductInterests(selected) };
}

export function slugifyProductInterestLabel(label: string): string {
  const slug = label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 64);
  if (!slug) return "";
  if (/^[a-z]/.test(slug)) return slug;
  return `o_${slug}`.slice(0, 64);
}
