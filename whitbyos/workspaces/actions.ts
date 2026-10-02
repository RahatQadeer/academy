"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { setOpenClientId } from "@/whitbyos/lib/open-client";

/**
 * Opening a client workspace, which is the only way into the product.
 *
 * Workspace Overview is where Whitby opens, and nothing on it navigates
 * anywhere until one of these is pressed: either a client, or every client at
 * once. That is deliberate — the screen exists to make somebody decide whose
 * work they are about to look at, and the rest of the product then answers
 * that question the same way on every screen rather than asking again on each.
 *
 * `revalidatePath("/", "layout")` and not a narrower path: the choice changes
 * what *every* screen returns, and the rail that names it is in the layout.
 */
export async function openClientWorkspace(formData: FormData) {
  const clientId = String(formData.get("client_id") ?? "").trim();
  const next = String(formData.get("next") ?? "").trim();

  await setOpenClientId(clientId || null);

  revalidatePath("/", "layout");
  redirect(safeWhitbyPath(next));
}

/** Only Whitby paths, so a crafted `next` cannot send somebody off the product. */
function safeWhitbyPath(path: string) {
  if (!path.startsWith("/whitbyos")) return "/whitbyos";
  if (path.startsWith("//") || path.includes("://")) return "/whitbyos";
  return path;
}

/**
 * Back to the choice, from the rail.
 *
 * Leaves the open client alone: somebody going to look at the whole picture
 * has not said they are finished with the client they were in, and having to
 * pick it again afterwards would be the screen taking something away for
 * having been visited.
 */
export async function goToWorkspaceOverview() {
  redirect("/whitbyos/workspaces");
}
