/**
 * What the header search looks through, and the shape of what it finds.
 *
 * Its own file because `HeaderSearch` is a client component and needs both.
 * `lib/search.ts` imports the four list readers, which reach `next/headers`
 * through the Supabase server client — so importing the scopes *from* there
 * pulled that whole tree into the browser bundle and the build refused it. A
 * type-only import would have been erased; the scope list is a value.
 *
 * Nothing here imports anything, which is the point.
 */
export const PORTAL_SEARCH_SCOPES = [
  "Requests",
  "Forms",
  "Documents",
  "Messages",
] as const;

export type PortalSearchScope = (typeof PORTAL_SEARCH_SCOPES)[number];

export type PortalSearchHit = {
  kind: "Request" | "Form" | "Document" | "Message";
  id: string;
  label: string;
  detail?: string;
  href: string;
};
