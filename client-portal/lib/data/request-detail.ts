import { createClient } from "@/base/lib/supabase/server";
import { getPortalContext } from "@/client-portal/lib/portal-context";
import * as fixtures from "@/client-portal/lib/fixtures";
import type { PortalNote, PortalRequestDetail, PortalRequestPerson } from "@/client-portal/types";

const EMPTY: PortalRequestDetail = {
  createdAt: null,
  ownerName: null,
  team: [],
  notes: [],
  taskOwners: {},
};

/**
 * The parts of Whitby's Request screens a client may see and cannot read
 * themselves: who owns the Request and who is on it (3.3o's Contacts), the
 * notes marked Visible to the client (3.3n), and who owns each client-visible
 * task (3.3t).
 *
 * `users` and `whitbyos_notes` are closed to a client, and should stay closed —
 * a `users` row carries email, phone and more. So these come through
 * `portal_request_detail()` (client-portal/014), which returns display names
 * and nothing else about a person, and only the notes somebody chose to share.
 *
 * Until 014 is applied the function is missing and this returns the empty
 * record, which the screens draw as "nobody named yet" rather than failing.
 */
export async function getRequestExtras(requestId: string): Promise<PortalRequestDetail> {
  const ctx = await getPortalContext();
  if (ctx.mode === "demo") return fixtures.REQUEST_EXTRAS[requestId] ?? EMPTY;
  if (!ctx.areas.requests) return EMPTY;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("portal_request_detail", {
    p_request_id: requestId,
  });

  if (error || !data || typeof data !== "object" || Array.isArray(data)) return EMPTY;
  const row = data as Record<string, unknown>;

  return {
    createdAt: typeof row.createdAt === "string" ? row.createdAt : null,
    ownerName: typeof row.ownerName === "string" ? row.ownerName : null,
    team: (Array.isArray(row.team) ? row.team : []).flatMap((entry): PortalRequestPerson[] => {
      const person = (entry ?? {}) as Record<string, unknown>;
      return typeof person.name === "string" && person.name.trim()
        ? [{ name: person.name, role: typeof person.role === "string" ? person.role : "" }]
        : [];
    }),
    notes: (Array.isArray(row.notes) ? row.notes : []).flatMap((entry): PortalNote[] => {
      const note = (entry ?? {}) as Record<string, unknown>;
      return typeof note.body === "string" && typeof note.createdAt === "string"
        ? [
            {
              id: String(note.id),
              body: note.body,
              createdAt: note.createdAt,
              authorName: typeof note.authorName === "string" ? note.authorName : null,
            },
          ]
        : [];
    }),
    taskOwners:
      row.taskOwners && typeof row.taskOwners === "object" && !Array.isArray(row.taskOwners)
        ? Object.fromEntries(
            Object.entries(row.taskOwners as Record<string, unknown>).filter(
              (pair): pair is [string, string] => typeof pair[1] === "string",
            ),
          )
        : {},
  };
}
