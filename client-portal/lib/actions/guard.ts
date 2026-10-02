import { AREA_LABEL } from "@/client-portal/lib/access";
import { getPortalContext, type PortalContext } from "@/client-portal/lib/portal-context";
import type { PortalArea } from "@/client-portal/types";

export type LiveContext = PortalContext & {
  contactId: string;
  clientId: string;
  workspaceId: string;
};

/**
 * Every write needs a real client identity. Until base links auth users to
 * `contacts`, this returns null on a demo session and the caller reports that
 * plainly rather than pretending the write succeeded.
 */
export async function requireLiveContext(): Promise<LiveContext | null> {
  const ctx = await getPortalContext();
  if (ctx.mode !== "live" || !ctx.contactId || !ctx.clientId || !ctx.workspaceId) {
    return null;
  }
  return ctx as LiveContext;
}

export const NOT_SAVED =
  "Not saved, this sample account has no client identity linked yet.";

export function toastUrl(path: string, message: string) {
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}toast=${encodeURIComponent(message)}`;
}

/** Trims a form value and returns null for empties, so we never store "". */
export function text(form: FormData, key: string): string | null {
  const value = form.get(key);
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * The one sentence a client sees when they reach past their own permissions.
 *
 * Names the area and says who decides, because "not permitted" on its own reads
 * as a fault. Nobody in the portal can widen their own access — the professional
 * grants it on 2.1.2.1 — so the only useful next step is to ask them.
 */
export function noAccessMessage(area: PortalArea): string {
  return `${AREA_LABEL[area]} is not part of your access to this account. Ask your team if you need it.`;
}

export const VIEW_ONLY =
  "Your access to this account is view only, so this was not saved. Ask your team if you need to make changes.";

/**
 * The read half, for an action that opens something rather than changing it.
 *
 * A download is a read: a view-only member is permitted to take a copy of a
 * document they are permitted to see, so this checks the area and stops there.
 */
export async function requireRead(
  area: PortalArea,
): Promise<{ ctx: LiveContext } | { reason: string }> {
  const context = await getPortalContext();
  if (!context.areas[area]) return { reason: noAccessMessage(area) };

  const ctx = await requireLiveContext();
  if (!ctx) return { reason: NOT_SAVED };

  return { ctx };
}

/**
 * The guard every write action starts with: a live identity, the area the write
 * belongs to, and not view-only.
 *
 * Returns a reason instead of throwing, so each action can redirect to its own
 * screen with its own toast rather than every failure landing on one page.
 *
 * This is enforcement, not decoration. The screens already hide what a client
 * cannot use, but a hidden button is a rendering decision — a stale tab, a
 * bookmarked URL, or a permission narrowed while somebody was typing all reach
 * the action anyway, and only this stops them.
 */
export async function requireWrite(
  area: PortalArea,
): Promise<{ ctx: LiveContext } | { reason: string }> {
  const context = await getPortalContext();

  if (!context.areas[area]) return { reason: noAccessMessage(area) };
  if (context.viewOnly) return { reason: VIEW_ONLY };

  const ctx = await requireLiveContext();
  if (!ctx) return { reason: NOT_SAVED };

  return { ctx };
}
