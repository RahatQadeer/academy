import { statusLabel } from "@/whitbyos/lib/format";

/**
 * A Work Stream's status vocabulary, kept out of `lib/work-plans.ts` because
 * WP.18 and WP.19 are client components and that module reaches for the
 * server-side Supabase client — importing a value from it would drag
 * `next/headers` into the browser bundle.
 */

/**
 * The statuses WP.19's Status select offers.
 *
 * "Running" is the reference's word for the enum's `active`, and "Blocked" is
 * not in `whitbyos_workstream_status` at all — migration 007 added it as a
 * boolean beside the status rather than altering a type base owns. The four the
 * design lists come first; `waiting` and `paused` stay reachable so a stream
 * already in one of them is never silently rewritten by opening the dialog.
 */
export const WORKSTREAM_STATUS = [
  { value: "active", label: "Running" },
  { value: "not_started", label: "Not Started" },
  { value: "complete", label: "Complete" },
  { value: "blocked", label: "Blocked" },
  { value: "waiting", label: "Waiting" },
  { value: "paused", label: "Paused" },
] as const;

export function workstreamStatusLabel(status: string, blocked = false) {
  if (blocked) return "Blocked";
  return (
    WORKSTREAM_STATUS.find((option) => option.value === status)?.label ??
    statusLabel(status)
  );
}
