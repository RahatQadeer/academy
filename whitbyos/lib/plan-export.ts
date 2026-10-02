/**
 * What WP.22 asks for, and what WP.24 draws because of it.
 *
 * Its own module, and free of anything server-side, because three screens have
 * to agree about the same options: the dialog that collects them, the toast
 * whose Download link carries them, and the document that honours them. Left
 * to themselves they would drift, and the drift would be silent — an option
 * that quietly stops changing anything is worse than one that was never there.
 */

export type ExportLayout = "list" | "table" | "timeline";

export const EXPORT_LAYOUTS: Array<{ value: ExportLayout; label: string }> = [
  { value: "list", label: "List" },
  { value: "table", label: "Table" },
  { value: "timeline", label: "Timeline" },
];

export type ExportOptions = {
  layout: ExportLayout;
  /** Off means the cover page only — the plan's shape without its contents. */
  streams: boolean;
  /** Owners, due dates and status, which the reference groups as one choice. */
  meta: boolean;
  notes: boolean;
  activity: boolean;
  letterhead: boolean;
};

/** WP.22's own state when it opens: two ticked, two not. */
export const EXPORT_DEFAULTS: ExportOptions = {
  layout: "list",
  streams: true,
  meta: true,
  /**
   * On by default now that it carries the steps.
   *
   * It used to add a next action and an attachment name, which is a thing you
   * ask for; it now adds how each task is actually done, which is the reason
   * somebody exports a plan at all. Off by default, the file was a list of
   * titles and dates — a worse copy of the screen.
   */
  notes: true,
  activity: false,
  letterhead: true,
};

/**
 * Marks a query as having come from the dialog.
 *
 * Without it an unticked box and an untouched export look identical — both
 * arrive as an absent parameter — and the preview would turn every option back
 * on the moment someone turned one off.
 */
const MARKER = "set";

export function readExportOptions(
  params: Record<string, string | string[] | undefined> | undefined,
): ExportOptions {
  const one = (key: string) => {
    const value = params?.[key];
    return Array.isArray(value) ? value[0] : value;
  };

  if (one(MARKER) !== "1") return EXPORT_DEFAULTS;

  const layout = EXPORT_LAYOUTS.find((row) => row.value === one("layout"))?.value ?? "list";

  return {
    layout,
    streams: one("streams") === "1",
    meta: one("meta") === "1",
    notes: one("notes") === "1",
    activity: one("activity") === "1",
    letterhead: one("letterhead") === "1",
  };
}

export function exportQuery(options: ExportOptions) {
  const query = new URLSearchParams({ [MARKER]: "1", layout: options.layout });
  for (const key of ["streams", "meta", "notes", "activity", "letterhead"] as const) {
    if (options[key]) query.set(key, "1");
  }
  return query.toString();
}
