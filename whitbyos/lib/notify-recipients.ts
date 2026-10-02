/**
 * Who an in-app event should reach, given the workspace's members and the
 * sparse preference rows (absence means on, matching 17.3).
 *
 * Kept free of the server so the filter can be tested without a database.
 */
export function inAppRecipients(
  memberIds: string[],
  offUserIds: string[],
  skipUserId?: string | null,
): string[] {
  const off = new Set(offUserIds);
  const seen = new Set<string>();
  const out: string[] = [];

  for (const id of memberIds) {
    if (!id || seen.has(id)) continue;
    if (skipUserId && id === skipUserId) continue;
    if (off.has(id)) continue;
    seen.add(id);
    out.push(id);
  }

  return out;
}

/** One person on a client account, as far as reaching their bell is concerned. */
export type PortalMember = {
  contactId: string;
  /** `whitbyos_client_members.portal_access`. Null is undecided, not refused. */
  portalAccess: boolean | null;
  /** Whether their granted areas include the one the notice is about. */
  reachesArea: boolean;
};

/**
 * Who on a client account a portal notice should reach.
 *
 * Somebody is told only if all of these hold: they are in the portal at all
 * (an identity exists, which is what accepting an invitation writes), the
 * professional has not switched their access off, the notice is about an area
 * they were granted, they did not switch the event off, and — when the notice
 * is addressed — they are one of the people it is addressed to.
 *
 * A contact can sit on more than one client, so a membership that does not
 * reach the area does not rule out a later one that does.
 */
export function portalRecipients(
  members: PortalMember[],
  inPortalContactIds: string[],
  offContactIds: string[],
  onlyContactIds?: string[] | null,
): string[] {
  const inPortal = new Set(inPortalContactIds);
  const off = new Set(offContactIds);
  const only = onlyContactIds ? new Set(onlyContactIds) : null;
  const seen = new Set<string>();
  const out: string[] = [];

  for (const member of members) {
    const id = member.contactId;
    if (!id || seen.has(id)) continue;
    if (only && !only.has(id)) continue;
    if (member.portalAccess === false || !member.reachesArea) continue;
    if (!inPortal.has(id) || off.has(id)) continue;
    seen.add(id);
    out.push(id);
  }

  return out;
}

/** An unread row for the same person, kind and entity is the same event again. */
export function isUnreadDuplicate(
  existing: { recipientUserId: string; kind: string; entityId: string }[],
  candidate: { recipientUserId: string; kind: string; entityId: string },
): boolean {
  return existing.some(
    (row) =>
      row.recipientUserId === candidate.recipientUserId &&
      row.kind === candidate.kind &&
      row.entityId === candidate.entityId,
  );
}
