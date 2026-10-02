import type { AcademyCredentialStatus, AcademyCredentialType } from "@/academy/lib/domain";

export type CredentialListView = "pending" | "awarded" | "expired" | "all";

export type AdminCredentialFilters = {
  view: CredentialListView;
  type: AcademyCredentialType | "all";
  status: AcademyCredentialStatus | "all";
  search: string;
};

const CREDENTIAL_TYPES = new Set<string>([
  "cpa_credential",
  "specialty_endorsement",
  "certificate_of_completion",
]);

const CREDENTIAL_STATUSES = new Set<string>([
  "required_learning",
  "applied_work",
  "final_assessment",
  "credential_review",
  "awarded",
]);

function parseView(value: string): CredentialListView {
  if (value === "awarded" || value === "all" || value === "expired") return value;
  return "pending";
}

function parseType(value: string): AdminCredentialFilters["type"] {
  if (!value || value === "all") return "all";
  return CREDENTIAL_TYPES.has(value) ? (value as AcademyCredentialType) : "all";
}

function parseStatus(value: string): AdminCredentialFilters["status"] {
  if (!value || value === "all") return "all";
  return CREDENTIAL_STATUSES.has(value) ? (value as AcademyCredentialStatus) : "all";
}

export function parseCredentialFilters(
  searchParams: Record<string, string | string[] | undefined>,
): AdminCredentialFilters {
  const first = (key: string) => {
    const value = searchParams[key];
    return Array.isArray(value) ? value[0] ?? "" : value ?? "";
  };

  return {
    view: parseView(first("view")),
    type: parseType(first("type")),
    status: parseStatus(first("status")),
    search: first("q").trim(),
  };
}

export function credentialsHref(filters: Partial<AdminCredentialFilters> = {}) {
  const params = new URLSearchParams();
  if (filters.view && filters.view !== "pending") params.set("view", filters.view);
  if (filters.type && filters.type !== "all") params.set("type", filters.type);
  if (filters.status && filters.status !== "all") params.set("status", filters.status);
  if (filters.search?.trim()) params.set("q", filters.search.trim());
  const query = params.toString();
  return query ? `/academy/admin/credentials?${query}` : "/academy/admin/credentials";
}

export function credentialIsExpired(expiresAt: string | null, now = Date.now()) {
  if (!expiresAt) return false;
  const time = Date.parse(expiresAt);
  return !Number.isNaN(time) && time < now;
}
