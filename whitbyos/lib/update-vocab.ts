/** Updates vocabulary, kept clear of the server module for the dialogs. */

/** 10.1's Category select, in the export's order. */
export const UPDATE_CATEGORIES = [
  "General",
  "Milestone",
  "Deadline",
  "Blocker",
  "Decision Needed",
];

/** `whitbyos_update_status`, and what the card calls each one. */
export const UPDATE_STATUS: Record<string, { label: string; tone: "success" | "warning" | "neutral" }> = {
  published: { label: "Published", tone: "success" },
  review: { label: "In Review", tone: "warning" },
  draft: { label: "Draft", tone: "neutral" },
};

export function statusLabel(value: string | null) {
  return UPDATE_STATUS[value ?? "draft"]?.label ?? "Draft";
}

export function statusTone(value: string | null) {
  return UPDATE_STATUS[value ?? "draft"]?.tone ?? "neutral";
}
