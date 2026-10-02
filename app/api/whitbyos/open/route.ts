import { NextResponse, type NextRequest } from "next/server";
import { setOpenClientId } from "@/whitbyos/lib/open-client";

/**
 * Open a client workspace on the way to something inside it.
 *
 * Workspace Overview lists work from every client at once, and pressing a late
 * task there used to land somebody on that task with whichever workspace they
 * had open last still selected — so the rail said one client's name over
 * another client's task, and every screen they moved to afterwards was
 * filtered to the wrong one. The item and the workspace it lives in are one
 * choice, and this makes them one press.
 *
 * A route handler rather than twenty forms on the page: rows stay links, which
 * means they hover, they can be opened in a new tab, and the browser shows
 * where they go. Setting a cookie is the one thing a Server Component cannot
 * do and a handler can.
 *
 * `to` is checked rather than trusted. It arrives in a URL somebody can type,
 * and an open redirect out of a product that holds client records is not a
 * thing to leave lying around — so it has to be a path inside Whitby, and a
 * path rather than a URL of any kind.
 */
export async function GET(request: NextRequest) {
  const asked = request.nextUrl.searchParams.get("to") ?? "/whitbyos";
  const client = request.nextUrl.searchParams.get("client");

  const to =
    asked.startsWith("/whitbyos") && !asked.startsWith("//") ? asked : "/whitbyos";

  /*
   * Three cases, and the third is the reason this is not a boolean.
   *
   * A client id opens that workspace. "all" clears the choice, which is what
   * a figure counted across every workspace has to do before it sends somebody
   * to the screen it was counted from — otherwise "9 active requests, all
   * workspaces" lands on a list showing two. And nothing at all leaves the
   * choice where it was, for a row with no client to name.
   */
  if (client === "all") await setOpenClientId(null);
  else if (client) await setOpenClientId(client);

  return NextResponse.redirect(new URL(to, request.nextUrl.origin));
}
