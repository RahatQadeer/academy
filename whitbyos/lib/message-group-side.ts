/**
 * Client contacts and providers do not share a group.
 *
 * A conversation is either on the client side (portal people) or on the
 * provider side (firms), plus the professional team. Mixing the two puts a
 * client's people and an outside firm in the same thread — which is what the
 * product refuses. Teammates sit on either side.
 */

export type GroupSide = "client" | "provider";

export function sideOfKind(kind: string | null | undefined): GroupSide | null {
  if (kind === "contact") return "client";
  if (kind === "provider") return "provider";
  return null;
}

/** Participant table types → the same two sides. */
export function sideOfParticipantType(type: string | null | undefined): GroupSide | null {
  if (type === "contact") return "client";
  if (type === "company") return "provider";
  return null;
}

export function sidesInKinds(kinds: Iterable<string>): Set<GroupSide> {
  const sides = new Set<GroupSide>();
  for (const kind of kinds) {
    const side = sideOfKind(kind);
    if (side) sides.add(side);
  }
  return sides;
}

export function mixesClientAndProvider(kinds: Iterable<string>): boolean {
  const sides = sidesInKinds(kinds);
  return sides.has("client") && sides.has("provider");
}

export const MIXED_GROUP_MESSAGE =
  "A group cannot include both client contacts and providers. Choose one side, plus your team.";
