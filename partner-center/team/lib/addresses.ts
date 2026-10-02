import type { CompanyLocation } from "@/partner-center/team/types";

type RawAddress = {
  id?: unknown;
  label?: unknown;
  street?: unknown;
  postal_code?: unknown;
  zip?: unknown;
  country?: unknown;
  line?: unknown;
  address?: unknown;
};

function asString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function newId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `loc_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/** Normalize companies.addresses jsonb (including legacy `{ label }` only). */
export function parseLocations(raw: unknown): CompanyLocation[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((entry, index) => {
    const row = (entry && typeof entry === "object" ? entry : {}) as RawAddress;
    const label = asString(row.label) || `Location ${index + 1}`;
    const streetField =
      asString(row.street) || asString(row.line) || asString(row.address);
    const postal = asString(row.postal_code) || asString(row.zip);
    const countryField = asString(row.country);
    const id = asString(row.id) || newId();

    // Legacy onboarding stored the full address line in `label` only.
    const isLegacyLabelOnly = !streetField && !postal && !countryField;

    return {
      id,
      label: isLegacyLabelOnly ? "Office" : label,
      street: isLegacyLabelOnly ? label : streetField,
      postal_code: postal,
      country: isLegacyLabelOnly ? "United States" : countryField || "United States",
    };
  });
}

export function serializeLocations(locations: CompanyLocation[]): unknown[] {
  return locations.map((loc) => ({
    id: loc.id,
    label: loc.label.trim(),
    street: loc.street.trim(),
    postal_code: loc.postal_code.trim(),
    country: loc.country.trim() || "United States",
  }));
}

export function formatLocationLine(loc: CompanyLocation): string {
  // Country is shown as the location heading; keep the line to street + postal.
  const parts = [loc.street, loc.postal_code].filter(Boolean);
  return parts.join(", ") || "—";
}

export function createLocationId() {
  return newId();
}

export function marketsToRaw(raw: unknown): string {
  if (typeof raw === "string") return raw.trim();
  if (!Array.isArray(raw)) return "";
  return raw
    .map((entry) => {
      if (typeof entry === "string") return entry.trim();
      if (entry && typeof entry === "object" && "label" in entry) {
        return asString((entry as { label?: unknown }).label);
      }
      return "";
    })
    .filter(Boolean)
    .join(", ");
}

export function marketsToLabel(raw: unknown): string {
  const label = marketsToRaw(raw);
  return label || "—";
}

export function serializeMarkets(value: string): { label: string }[] | null {
  const trimmed = value.trim();
  return trimmed ? [{ label: trimmed }] : null;
}
