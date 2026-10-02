/**
 * The words WhitbyOS files things under, and how the portal draws each one.
 *
 * Every list here is the client-side half of a vocabulary that lives on the
 * professional side — `whitbyos/lib/form-vocab.ts`, `update-vocab.ts` and the
 * check constraints in `whitbyos/migrations/010`. WhitbyOS is the only writer,
 * so these are read-only mirrors: the portal never invents a category, and a
 * value it does not recognise is shown as written rather than dropped or
 * relabelled. That last rule matters — `category` is a free-text column on both
 * `whitbyos_forms` and `whitbyos_updates`, so a value outside the agreed set is
 * always possible and is still a fact about the row.
 *
 * Kept out of `lib/status.ts` because that file maps *states* — what something
 * is doing — onto the client's four buckets. A category says what kind of thing
 * it is, which is a different question and is never collapsed.
 */

type Tone = "success" | "warning" | "danger" | "info" | "neutral" | "accent";

/**
 * `UPDATE_CATEGORIES` from `whitbyos/lib/update-vocab.ts`, in 10.1's order.
 *
 * The tones are the portal's own reading of them, and they are not arbitrary:
 * the two categories that mean the client has something to do — a Deadline and
 * a Decision Needed — carry warning and accent, so the feed answers "is any of
 * this mine?" before a word of the body is read. A Blocker is danger because it
 * is the one that says the work has stopped.
 */
export const UPDATE_CATEGORY: Record<string, Tone> = {
  General: "neutral",
  Milestone: "success",
  Deadline: "warning",
  Blocker: "danger",
  "Decision Needed": "accent",
};

export function updateCategoryTone(category: string | null): Tone {
  if (!category) return "neutral";
  return UPDATE_CATEGORY[category] ?? "neutral";
}

/**
 * `FORM_CATEGORIES` from `whitbyos/lib/form-vocab.ts`, in the order the
 * builder's select lists them. Used to order the Forms screen's groups; a form
 * whose category is null is filed under Other, which is the builder's own
 * catch-all rather than a new word invented here.
 */
export const FORM_CATEGORIES = [
  "Onboarding",
  "Providers",
  "Confirmations",
  "Travel",
  "Other",
] as const;

/**
 * `whitbyos_requests.urgency` — the four values migration 010's check
 * constraint allows, and what the client is told for each.
 *
 * The words are the professional's own. A client reading "Critical" on their
 * own request is reading the same word their attaché is working to, and
 * softening it here would mean the two sides describing one request
 * differently — which is the failure this whole exercise is about.
 */
export const REQUEST_URGENCY: Record<string, { label: string; tone: Tone }> = {
  critical: { label: "Critical", tone: "danger" },
  high: { label: "High", tone: "warning" },
  medium: { label: "Medium", tone: "neutral" },
  low: { label: "Low", tone: "neutral" },
};

/**
 * Medium is the column default, so it is what almost every request carries and
 * saying so on every row would be noise. Null means "draw nothing".
 */
export function urgencyView(raw: string | null) {
  if (!raw || raw === "medium" || raw === "low") return null;
  return REQUEST_URGENCY[raw] ?? null;
}

/**
 * `whitbyos_requests.health` — migration 010's three values.
 *
 * On track is drawn as nothing at all, for the same reason Medium urgency is:
 * it is the default and the ordinary case, and a green "On track" badge on
 * every request would leave the client no way to notice the one that is not.
 */
export const REQUEST_HEALTH: Record<string, { label: string; tone: Tone }> = {
  on_track: { label: "On track", tone: "success" },
  needs_attention: { label: "Needs attention", tone: "warning" },
  at_risk: { label: "At risk", tone: "danger" },
};

export function healthView(raw: string | null) {
  if (!raw || raw === "on_track") return null;
  return REQUEST_HEALTH[raw] ?? null;
}
