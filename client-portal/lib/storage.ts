/**
 * Storage paths shared between server actions and the screens that read them.
 *
 * Lives outside `lib/actions/` because that folder is `"use server"`, and a
 * `"use server"` module may only export async functions — a plain helper
 * exported from one fails the build ("Server Actions must be async functions").
 */

/** Predictable per-contact path — no DB column needed, existence check doubles as lookup. */
export function avatarStoragePath(contactId: string) {
  return `${contactId}/photo`;
}
