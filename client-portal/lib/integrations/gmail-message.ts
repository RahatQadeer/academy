/**
 * Reading one Gmail message — a copy of `whitbyos/lib/gmail-message.ts`, kept
 * in the portal's own module rather than imported, so the two products'
 * integrations can move independently.
 *
 * Pure: nothing here talks to Gmail or the database, and nothing is imported at
 * runtime, so a test can load it directly.
 */

/**
 * `base/lib/email.ts`'s `normalizeEmail`, spelled out rather than imported.
 *
 * Importing it would put an `@/` path in this module's runtime graph and the
 * test could no longer load the file. It is trim-and-lowercase in both places;
 * if that ever stops being true, `addressIn` is the caller to fix.
 */
function normalizeEmail(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

export type GmailPart = {
  mimeType?: string;
  headers?: { name?: string; value?: string }[];
  body?: { data?: string; size?: number };
  parts?: GmailPart[];
};

export type GmailMessage = {
  id?: string;
  threadId?: string;
  internalDate?: string;
  /** Gmail's own one-line preview. Stored as-is; the body never is. */
  snippet?: string;
  payload?: GmailPart;
};

/** Header names are case-insensitive, and Gmail does not normalise them. */
export function header(payload: GmailPart | undefined, name: string): string | null {
  const found = (payload?.headers ?? []).find(
    (row) => row.name?.toLowerCase() === name.toLowerCase(),
  );
  return found?.value ?? null;
}

/**
 * The address out of a From line.
 *
 * "Jordan Hartwell <j@x.com>" is an address with a name in front of it, and it
 * is the address that has to match the allowed list — a display name is chosen
 * by the sender and is not a permission.
 */
export function addressIn(value: string | null | undefined): string {
  if (!value) return "";
  const angled = value.match(/<([^>]+)>/);
  return normalizeEmail(angled ? angled[1] : value);
}

/**
 * The name in front of the address, when the sender put one there.
 *
 * Kept beside `from_email` because a screen reads better with "Jordan
 * Hartwell" on it than with an address, and because it is the only place the
 * sender's own spelling of their name survives — it is never matched against
 * anything, which is `addressIn`'s job.
 */
export function displayNameIn(value: string | null | undefined): string | null {
  if (!value) return null;
  const angled = value.match(/^(.*)<[^>]+>\s*$/);
  if (!angled) return null;
  const name = angled[1].trim().replace(/^"(.*)"$/, "$1").trim();
  return name || null;
}

/**
 * The readable text of a message.
 *
 * Gmail nests parts arbitrarily — a reply with an attachment is commonly
 * multipart/mixed wrapping multipart/alternative — so the tree is walked
 * rather than the first part being assumed. text/plain is preferred and HTML
 * is the fallback with its tags stripped, because the model is being asked
 * what the mail says, not what it looks like.
 */
export function textOf(payload: GmailPart | undefined): string {
  if (!payload) return "";

  const decode = (data: string | undefined) =>
    data ? Buffer.from(data, "base64url").toString("utf8") : "";

  const collect = (part: GmailPart, wanted: string): string => {
    if (part.mimeType === wanted && part.body?.data) return decode(part.body.data);
    for (const child of part.parts ?? []) {
      const found = collect(child, wanted);
      if (found) return found;
    }
    return "";
  };

  const plain = collect(payload, "text/plain");
  if (plain) return plain;

  const html = collect(payload, "text/html");
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
