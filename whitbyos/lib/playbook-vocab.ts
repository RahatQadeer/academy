/**
 * Playbook vocabulary, kept clear of the server module so the dialogs can
 * import it — the same split the other modules make.
 */

/**
 * `shared_level` is free text in the schema; these are the three the export
 * writes, and the order is how far each one reaches.
 */
export const SHARED_LEVELS = [
  { value: "private", label: "My Playbooks", tone: "neutral" as const },
  { value: "team", label: "Shared with Team", tone: "warning" as const },
  { value: "organization", label: "Organization", tone: "info" as const },
];

export function sharedLabel(value: string | null) {
  return SHARED_LEVELS.find((level) => level.value === value)?.label ?? "My Playbooks";
}

/**
 * Who can see it, as a sentence — not the tab the Playbook sits in.
 *
 * `sharedLabel` is "My Playbooks" / "Shared with Team", which is the library
 * filter. "Visible to: my playbooks" reads as a place rather than as people.
 */
export function sharedAudience(value: string | null) {
  if (value === "team") return "your team";
  if (value === "organization") return "the organisation";
  return "only you";
}

export function sharedTone(value: string | null) {
  return SHARED_LEVELS.find((level) => level.value === value)?.tone ?? "neutral";
}

/**
 * 6.0b's Category select, in its order and with nothing added.
 *
 * Travel and Property were here and are not in the reference. A Playbook that
 * already carries one keeps it — this list is what the select offers, not what
 * the column allows — but offering categories the reference does not have
 * quietly makes a different taxonomy than the one the firm agreed to.
 */
export const PLAYBOOK_CATEGORIES = [
  "Relocation",
  "Legal & Estate",
  "Staffing",
  "Corporate",
  "Other",
];

/**
 * What a playbook holds. `contents` is jsonb, so the shape is ours to define —
 * a list of Work Streams, each with its tasks, which is exactly what 6.1 draws
 * and what building a Work Plan from one needs to read.
 */
export type PlaybookTask = {
  title: string;
  checklist?: string[];
};

export type PlaybookStream = {
  name: string;
  purpose?: string;
  tasks: PlaybookTask[];
};

export function readStreams(contents: unknown): PlaybookStream[] {
  if (!contents || typeof contents !== "object") return [];
  const streams = (contents as { streams?: unknown }).streams;
  if (!Array.isArray(streams)) return [];

  return streams.flatMap((raw) => {
    if (!raw || typeof raw !== "object") return [];
    const row = raw as Record<string, unknown>;
    const name = typeof row.name === "string" ? row.name : null;
    if (!name) return [];

    const tasks = Array.isArray(row.tasks)
      ? row.tasks.flatMap((task) => {
          if (typeof task === "string") return [{ title: task }];
          if (!task || typeof task !== "object") return [];
          const t = task as Record<string, unknown>;
          if (typeof t.title !== "string") return [];
          return [
            {
              title: t.title,
              checklist: Array.isArray(t.checklist)
                ? t.checklist.filter((item): item is string => typeof item === "string")
                : undefined,
            },
          ];
        })
      : [];

    return [
      {
        name,
        purpose: typeof row.purpose === "string" ? row.purpose : undefined,
        tasks,
      },
    ];
  });
}

/** "4 tasks · 1 Checklist" — what 6.1 puts under a Work Stream's name. */
export function streamSummary(stream: PlaybookStream) {
  const checklists = stream.tasks.filter((task) => (task.checklist?.length ?? 0) > 0).length;
  const parts = [`${stream.tasks.length} task${stream.tasks.length === 1 ? "" : "s"}`];
  if (checklists > 0) parts.push(`${checklists} Checklist${checklists === 1 ? "" : "s"}`);
  return parts.join(" · ");
}
