/**
 * Edge-safe Super Admin staff cookie helpers (usable from middleware).
 * Do not import Node `crypto` or `server-only` here.
 *
 * Session: HMAC-signed cookie, short TTL, SameSite=Lax, Secure on HTTPS.
 * Dedicated SUPER_ADMIN_SESSION_SECRET only (no service-role fallback).
 */

export const STAFF_SESSION_COOKIE = "__Host-pa_super_admin";
/** Fallback name when __Host- cannot be used (local http). */
export const STAFF_SESSION_COOKIE_FALLBACK = "pa_super_admin";
export const STAFF_SESSION_MAX_AGE_SEC = 60 * 60 * 2; // 2 hours

export type StaffPayload = {
  email: string;
  exp: number;
  iat: number;
  v: 2;
};

function sessionSecret() {
  const secret = process.env.SUPER_ADMIN_SESSION_SECRET?.trim();
  if (!secret || secret.length < 32) {
    throw new Error(
      "SUPER_ADMIN_SESSION_SECRET must be set (min 32 characters). Generate with: openssl rand -base64 48",
    );
  }
  return secret;
}

function useHostCookie() {
  // __Host- requires Secure; fine on Vercel / HTTPS. Local http uses fallback name.
  return (
    process.env.VERCEL === "1" ||
    process.env.NODE_ENV === "production" ||
    process.env.SUPER_ADMIN_COOKIE_SECURE === "1"
  );
}

export function staffSessionCookieName() {
  return useHostCookie() ? STAFF_SESSION_COOKIE : STAFF_SESSION_COOKIE_FALLBACK;
}

function bytesToBase64Url(bytes: ArrayBuffer | Uint8Array) {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = "";
  for (let i = 0; i < u8.length; i++) binary += String.fromCharCode(u8[i]!);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlToBytes(value: string) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const pad = padded.length % 4 === 0 ? "" : "=".repeat(4 - (padded.length % 4));
  const binary = atob(padded + pad);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

function timingSafeEqualStr(a: string, b: string) {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

async function sign(body: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(sessionSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(body),
  );
  return bytesToBase64Url(signature);
}

export async function createStaffSessionValue(email: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const payload: StaffPayload = {
    email: email.trim().toLowerCase(),
    iat: now,
    exp: now + STAFF_SESSION_MAX_AGE_SEC,
    v: 2,
  };
  const body = bytesToBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
  const sig = await sign(body);
  return `${body}.${sig}`;
}

export async function verifyStaffSessionValue(
  token: string | undefined | null,
): Promise<StaffPayload | null> {
  if (!token || !token.includes(".")) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;

  let expected: string;
  try {
    expected = await sign(body);
  } catch {
    return null;
  }

  if (!timingSafeEqualStr(sig, expected)) return null;

  try {
    const json = new TextDecoder().decode(base64UrlToBytes(body));
    const payload = JSON.parse(json) as StaffPayload;
    if (!payload?.email || typeof payload.exp !== "number" || payload.v !== 2) {
      return null;
    }
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return {
      email: payload.email.trim().toLowerCase(),
      exp: payload.exp,
      iat: payload.iat,
      v: 2,
    };
  } catch {
    return null;
  }
}

export function staffCookieOptions(maxAge = STAFF_SESSION_MAX_AGE_SEC) {
  const secure = useHostCookie();
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure,
    path: "/",
    maxAge,
  };
}

/** Read staff token from either cookie name (host or fallback). */
export function readStaffSessionCookie(
  getCookie: (name: string) => string | undefined,
) {
  return (
    getCookie(STAFF_SESSION_COOKIE) ||
    getCookie(STAFF_SESSION_COOKIE_FALLBACK) ||
    undefined
  );
}
