import type { ClientType } from "@/whitbyos/types";

const CLIENT_TYPE_LABELS: Record<ClientType, string> = {
  individual: "Individual",
  family: "Family",
  company: "Company",
  organization: "Organization",
};

/**
 * SRS 1.10 — a Client may represent an individual, a family or household, a
 * company, or an organization. Household is listed on its own because that is
 * how Settings and onboarding already ask the question.
 */
export const SRS_CLIENT_CLASSIFICATIONS = [
  "Individual",
  "Family",
  "Household",
  "Company",
  "Organization",
] as const;

/** The create dialog uses the documented list, not leftover Settings defaults. */
export function classificationsForCreate() {
  return [...SRS_CLIENT_CLASSIFICATIONS];
}

export function clientTypeLabel(type: ClientType) {
  return CLIENT_TYPE_LABELS[type] ?? "Not set";
}

/**
 * What a client is, in the firm's own words where it has them.
 *
 * The classification is what the firm chose from its own list; `client_type`
 * is the four-value enum underneath, and the only thing clients recorded
 * before that list was wired have. Asked in one place so six screens cannot
 * answer it six ways.
 */
/**
 * The same answer for a value already flattened to a string.
 *
 * Workspace Overview and the archive read `type` off a row that has already
 * resolved classification-or-enum, and they were passing it through
 * `clientTypeLabel`, whose map only knows the four enum names — so a client
 * the firm classified "Estate" was labelled "Not set". An enum name is
 * titled; anything else is already the firm's own word and is shown as it was
 * written.
 */
export function kindLabel(value: string | null | undefined) {
  const text = value?.trim();
  if (!text) return "Not set";
  return CLIENT_TYPE_LABELS[text as ClientType] ?? text;
}

export function clientKind(client: {
  classification?: string | null;
  client_type: ClientType;
}) {
  return client.classification?.trim() || clientTypeLabel(client.client_type);
}

/** Turns a stored status like `at_risk` into the Figma's "At risk". */
export function statusLabel(status: string) {
  if (!status) return "Not set";
  const spaced = status.replace(/_/g, " ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/** Relative time as the Figma writes it: "2h ago", "3d ago", "2w ago". */
export function relativeTime(iso: string | null | undefined, now = Date.now()) {
  if (!iso) return "No date";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "No date";

  const seconds = Math.round((now - then) / 1000);
  if (seconds < 60) return "just now";

  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;

  const weeks = Math.round(days / 7);
  if (weeks < 5) return `${weeks}w ago`;

  const months = Math.round(days / 30);
  if (months < 12) return `${months}mo ago`;

  return `${Math.round(days / 365)}y ago`;
}

/** Short date as the Figma writes it: "Mar 14". */
export function shortDate(iso: string | null | undefined) {
  // "Not set" rather than a dash. A dash in a Due column asks the reader to
  // work out whether it means no date, no answer, or a rendering failure.
  if (!iso) return "Not set";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Not set";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function contactName(
  contact: { first_name: string; last_name: string } | null,
) {
  if (!contact) return "No contact";
  return [contact.first_name, contact.last_name].filter(Boolean).join(" ") || "No contact";
}

/**
 * Integer cents, in the invoice's own currency.
 *
 * `currency` is never defaulted at a call site: an invoice carries its own, and
 * a hardcoded symbol is how a GBP invoice comes to be shown with a dollar sign.
 */
export function money(cents: number, currency: string): string {
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  });
}
