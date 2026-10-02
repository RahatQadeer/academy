/**
 * Workspace URL slugs (`workspaces.url_slug`).
 *
 * The column is unique in the schema. These helpers keep every writer — Settings,
 * onboarding, the API — on the same spelling and the same refusal when another
 * workspace already holds the name.
 */

const RESERVED = new Set([
  "www",
  "app",
  "api",
  "admin",
  "login",
  "signup",
  "auth",
  "invite",
  "onboarding",
  "switcher",
  "whitby",
  "portal",
  "academy",
  "partner",
]);

export const SLUG_TAKEN =
  "This organization URL is already taken. Choose a different one.";

/**
 * Take the last path segment if somebody pasted a whitby.app address, otherwise
 * slugify the raw value.
 */
function sourceForSlug(value: string) {
  const trimmed = value.trim();
  const fromUrl = trimmed.match(
    /^(?:https?:\/\/)?(?:www\.)?whitby\.app\/+([a-z0-9-]+)\/?$/i,
  );
  return fromUrl?.[1] ?? trimmed;
}

export function slugifyWorkspaceUrl(value: string) {
  return sourceForSlug(value)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 48);
}

export function workspaceUrlError(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return "Enter an organization URL.";
  }
  const slug = slugifyWorkspaceUrl(trimmed);
  if (!slug || slug.length < 2) {
    return "Use at least two letters or numbers. Hyphens are allowed.";
  }
  if (RESERVED.has(slug)) {
    return "This organization URL is reserved. Choose a different one.";
  }
  return null;
}

/** Postgres unique_violation, including when RLS hides the other row. */
export function isSlugTakenError(error: { code?: string; message?: string } | null) {
  if (!error) return false;
  if (error.code === "23505") return true;
  return /url_slug|duplicate key/i.test(error.message ?? "");
}
