/**
 * Provider vocabulary, kept clear of the server module so the Add dialog can
 * import it — the same split `contact-vocab`, `task-vocab` and
 * `workstream-status` make.
 */

/** `whitbyos_provider_readiness`, in the order §6.9 walks a provider through. */
export const READINESS = [
  { value: "prospect", label: "Prospect" },
  { value: "screened", label: "Screened" },
  { value: "qualified", label: "Qualified" },
  { value: "preferred", label: "Preferred" },
  { value: "inactive", label: "Inactive" },
  { value: "excluded", label: "Excluded" },
] as const;

/**
 * What the firm has done about this provider. Free text in the schema; these
 * are the states the export writes out.
 *
 * "Replied" used to sit in here as well as in `RESPONSES` below, and it does
 * not belong in both. This field is our side of the exchange and that one is
 * theirs, so replying is not a step the firm takes: somebody choosing it here
 * was recording their answer in the field that holds our action, and the two
 * dropdowns disagreed from then on. Nothing was ever stored under it.
 */
export const OUTREACH = [
  { value: "not_started", label: "Not Started" },
  { value: "contacted", label: "Contacted" },
  { value: "follow_up", label: "Follow-Up" },
  { value: "closed", label: "Closed / No Further Outreach" },
] as const;

/** Anything written before "Replied" left the list above still reads. */
const RETIRED_OUTREACH: Record<string, string> = { replied: "Replied" };

export function readinessLabel(value: string | null) {
  return READINESS.find((r) => r.value === value)?.label ?? value ?? "Not recorded";
}

/** Preferred is the endorsement; excluded is the warning; the rest are steps. */
export function readinessTone(value: string | null) {
  switch (value) {
    case "preferred":
      return "success" as const;
    case "qualified":
      return "info" as const;
    case "excluded":
      return "danger" as const;
    case "inactive":
      return "neutral" as const;
    default:
      return "warning" as const;
  }
}

export function outreachLabel(value: string | null) {
  if (!value) return "Not recorded";
  return (
    OUTREACH.find((o) => o.value === value)?.label ??
    RETIRED_OUTREACH[value] ??
    value
  );
}


/** 5.0a's Category, which the export fixes to six rather than leaving open. */
export const CATEGORIES = [
  "Financial Advisory",
  "Relocation Services",
  "Household Staffing",
  "Legal",
  "Insurance",
  "Other",
] as const;

/** 5.0a's Source — how this provider came to be in the directory (§6.9). */
export const SOURCES = [
  { value: "existing_relationship", label: "Existing relationship" },
  { value: "client_referral", label: "Client referral" },
  { value: "cold_outreach", label: "Cold outreach" },
  { value: "directory_research", label: "Directory / research" },
] as const;

export function sourceLabel(value: string | null) {
  if (!value) return null;
  return SOURCES.find((s) => s.value === value)?.label ?? value;
}

/**
 * 5.1's "Response state": whether they have answered, as distinct from what we
 * have done about it. Free text in the schema, like `outreach_status`.
 *
 * Outreach State asks what the firm did. This asks what they did back. The two
 * together are the only way to tell who is being waited on, which is the
 * question the directory exists to answer: awaiting a reply is somebody to
 * chase, no response is somebody to stop chasing.
 */
export const RESPONSES = [
  { value: "awaiting", label: "Awaiting reply" },
  { value: "replied", label: "Replied" },
  { value: "declined", label: "Declined" },
  { value: "no_response", label: "No response" },
] as const;

export function responseLabel(value: string | null) {
  if (!value) return null;
  return RESPONSES.find((r) => r.value === value)?.label ?? value;
}

/**
 * What a provider option's status says, which is why this provider is on that
 * request: shortlisted, put to the client, chosen, or passed over.
 */
export const OPTION_STATUS: Record<string, string> = {
  shortlisted: "Shortlisted",
  presented: "Presented to client",
  selected: "Selected",
  rejected: "Not chosen",
  retained: "Retained",
};

export function optionLabel(value: string | null) {
  if (!value) return "On this request";
  return OPTION_STATUS[value] ?? value;
}
