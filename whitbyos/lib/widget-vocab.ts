/**
 * Screen 1.3's list, in the order Home lays them out.
 *
 * Nine, which is what the Add Widget modal offers. Home draws the `main` ones
 * in the wide column and the rest in the 300px rail beside it, which is the
 * `column` here: the modal is one list, the dashboard is two.
 *
 * The two charts are on by default. A screen of counts and lists says how much
 * there is and never what shape it is in, which is the first thing somebody
 * wants from a morning glance.
 */
export const WIDGETS = [
  { key: "outstanding", label: "Outstanding & Overdue Requests", column: "main" as const, on: true },
  { key: "overdue_tasks", label: "Overdue Tasks", column: "main" as const, on: true },
  { key: "load", label: "What is due (chart)", column: "main" as const, on: true },
  { key: "plan_progress", label: "Work Plan progress", column: "side" as const, on: true },
  { key: "feed", label: "Recent Messages & Updates", column: "main" as const, on: true },
  { key: "this_week", label: "This Week (Calendar)", column: "side" as const, on: true },
  { key: "insights", label: "Insights", column: "side" as const, on: true },
  { key: "team_activity", label: "Team Activity", column: "side" as const, on: false },
  { key: "providers", label: "Providers Needing Outreach", column: "side" as const, on: false },
] as const;

export type WidgetKey = (typeof WIDGETS)[number]["key"];

export const WIDGET_KEYS = new Set<string>(WIDGETS.map((widget) => widget.key));
