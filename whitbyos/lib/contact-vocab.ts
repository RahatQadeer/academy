/**
 * The words and helpers the Contacts screens share, kept apart from
 * `lib/contacts.ts` because that module reaches for the server-side Supabase
 * client and the Add dialog is a client component — importing a value from it
 * would pull `next/headers` into the browser bundle.
 */

export type RoleLabel =
  | "primary_member"
  | "additional_member"
  | "authorized_user"
  | "dependent"
  | "primary_contact"
  | "billing_contact"
  | "decision_maker"
  | "authorized_representative"
  | "provider";

/** The five the Add dialog offers, in the order the export lists them. */
export const RELATIONSHIP_OPTIONS: { value: RoleLabel; label: string }[] = [
  { value: "authorized_user", label: "Authorized User" },
  { value: "primary_contact", label: "Primary Contact" },
  { value: "additional_member", label: "Additional Member" },
  { value: "decision_maker", label: "Decision-Maker" },
  { value: "billing_contact", label: "Billing Contact" },
];

const ROLE_LABELS: Record<string, string> = {
  primary_member: "Primary Member",
  additional_member: "Additional Member",
  authorized_user: "Authorized User",
  dependent: "Dependent",
  primary_contact: "Primary Contact",
  billing_contact: "Billing Contact",
  decision_maker: "Decision-Maker",
  authorized_representative: "Authorized Representative",
  provider: "Provider",
};

/** The relationship filter on 4 and 4.1 offers exactly what a row can say. */
export const ROLES = Object.entries(ROLE_LABELS).map(([value, label]) => ({
  value,
  label,
}));

export function roleLabel(role: string | null) {
  if (!role) return null;
  return ROLE_LABELS[role] ?? role;
}

/** Primary Contact reads as the strongest tie, then the softer roles. */
export function roleTone(role: string | null) {
  switch (role) {
    case "primary_contact":
      return "info" as const;
    case "authorized_user":
    case "decision_maker":
      return "warning" as const;
    default:
      return "neutral" as const;
  }
}

export function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

/** "Diane Okafor" → { first: "Diane", last: "Okafor" }; `contacts` needs both. */
export function firstAndLast(fullNameInput: string) {
  const parts = fullNameInput.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return null;
  if (parts.length === 1) return { first: parts[0]!, last: parts[0]! };
  return { first: parts[0]!, last: parts.slice(1).join(" ") };
}
