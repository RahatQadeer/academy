"use server";

import { searchPortal } from "@/client-portal/lib/search";
import type { PortalSearchHit } from "@/client-portal/lib/search-vocab";

/**
 * The header search box's one call.
 *
 * A server action rather than a route: the readers behind `searchPortal` are
 * server-only and already carry this client's session, so there is nothing for
 * an API surface to add except a second place to get the auth wrong.
 */
export async function searchPortalAction(query: string): Promise<PortalSearchHit[]> {
  return searchPortal(query);
}
