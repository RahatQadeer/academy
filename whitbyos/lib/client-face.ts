/**
 * A client workspace's own mark: two letters and a colourway.
 *
 * Shared, because a client showing up in one colour on Workspace Overview and
 * another in the rail is a client somebody has to read the name of twice. The
 * colour comes from the name rather than from a position in a list, so it
 * survives the list being reordered and two screens agree without being told.
 */

const FACES = [
  { background: "var(--avatar-tan-bg)", color: "var(--avatar-tan-fg)" },
  { background: "var(--accent-tint)", color: "var(--accent)" },
  { background: "var(--avatar-green-bg)", color: "var(--avatar-green-fg)" },
  { background: "var(--avatar-orange-bg)", color: "var(--avatar-orange-fg)" },
];

/**
 * Quiet marks for the workspace rail — ink / soft blue only.
 * Pastel circles read playful on Overview; the rail stays professional.
 */
const RAIL_FACES = [
  { background: "var(--surface-soft)", color: "var(--ink)" },
  { background: "color-mix(in srgb, var(--accent) 14%, white)", color: "var(--accent)" },
  { background: "var(--canvas)", color: "var(--text-secondary)" },
  { background: "color-mix(in srgb, var(--ink) 8%, white)", color: "var(--ink)" },
];

export function faceForRail(name: string) {
  const sum = [...name].reduce((total, char) => total + char.charCodeAt(0), 0);
  return RAIL_FACES[sum % RAIL_FACES.length];
}

export function faceFor(name: string) {
  const sum = [...name].reduce((total, char) => total + char.charCodeAt(0), 0);
  return FACES[sum % FACES.length];
}

/** Two letters from a name — one word gives its first two. */
export function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0]}${parts[1]![0]}`.toUpperCase();
}
