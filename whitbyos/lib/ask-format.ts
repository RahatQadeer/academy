/**
 * Display helpers for Ask Whitby — safe for client components.
 * Keep server I/O out of this file.
 */

/** Rail label — capitalise even when an older row was stored in lowercase. */
export function askThreadLabel(title: string) {
  const clean = title.replace(/\s+/g, " ").trim();
  if (!clean) return "New chat";
  return clean.charAt(0).toUpperCase() + clean.slice(1);
}
