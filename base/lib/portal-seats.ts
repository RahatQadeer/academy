/*
 * Deliberately not `server-only`. This module holds one number and one pure
 * parser — no key, no query, nothing to keep off a client — and Super Admin's
 * seat board is a client component that needs the baseline to tell a raised
 * workspace from a standard one.
 */

/**
 * Additional Members a client portal account may hold when nobody has said
 * otherwise.
 *
 * The number lives on `workspaces.max_additional_members`, which is NOT NULL
 * with this same default (supabase/00056). This constant is the value the app
 * falls back to when the column cannot be read at all — demo mode, or an
 * environment that has not applied the migration yet — so that the portal
 * describes the same account size in every one of those states.
 */
export const DEFAULT_MAX_ADDITIONAL_MEMBERS = 10;

/** The bound Super Admin's form enforces, and the schema's CHECK constraint. */
export const MAX_SEAT_LIMIT = 999;

/**
 * A seat limit as typed, or an error.
 *
 * Blank is a real answer for Authorized Users (no limit) and not one for
 * Additional Members, so the caller says which it is taking.
 */
export function parseSeatLimit(
  raw: string,
  { blankAllowed }: { blankAllowed: boolean },
): { value: number | null } | { error: string } {
  const trimmed = raw.trim();
  if (trimmed === "") {
    if (blankAllowed) return { value: null };
    return { error: "Enter a number. This one cannot be left blank." };
  }

  const value = Number(trimmed);
  if (!Number.isInteger(value) || value < 0 || value > MAX_SEAT_LIMIT) {
    return { error: `Enter a whole number between 0 and ${MAX_SEAT_LIMIT}.` };
  }
  return { value };
}
