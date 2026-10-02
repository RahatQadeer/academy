/**
 * The fallback name of production, for the one project that has no better
 * answer. Prefer `productionHost()` — two Vercel projects build this repo and
 * each owns a different domain, so a single constant is right for at most one
 * of them.
 */
export const PRODUCTION_HOST = "private-attache-dun.vercel.app";

/**
 * This deployment's own production domain.
 *
 * Vercel sets VERCEL_PROJECT_PRODUCTION_URL to the domain of the project the
 * build belongs to: `private-attache-dun.vercel.app` on one, and
 * `private-attache-system.vercel.app` on the other. Reading it means each
 * project is its own home instead of both being told they are the first one —
 * which is what sent every visit to private-attache-system.vercel.app away to
 * a deployment built from a different branch.
 */
export function productionHost() {
  return process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim() || PRODUCTION_HOST;
}

/**
 * A preview build's own host. NEXT_PUBLIC_SITE_URL is set for Preview as well
 * as Production, and it names production — so every link a branch deployment
 * made pointed at the one deployment that does not have the branch on it.
 * Prefer the branch alias, which is stable across pushes and can be allowed
 * once in Supabase; the per-deployment URL is the fallback.
 */
function previewUrl() {
  if (process.env.VERCEL_ENV !== "preview") return null;
  const branch = process.env.VERCEL_BRANCH_URL?.trim();
  if (branch) return `https://${branch.replace(/\/$/, "")}`;
  const deployment = process.env.VERCEL_URL?.trim();
  if (deployment) return `https://${deployment.replace(/\/$/, "")}`;
  return null;
}

export function siteUrl() {
  if (process.env.NODE_ENV === "development") {
    const port = process.env.PORT || "3000";
    return `http://localhost:${port}`;
  }

  // In a browser the host is not a thing to be configured: it is the one the
  // person is on. VERCEL_ENV is not in the client bundle, so a preview build
  // reading the variable below would send them to production from the page.
  if (typeof window !== "undefined") return window.location.origin;

  const preview = previewUrl();
  if (preview) return preview;

  // Before NEXT_PUBLIC_SITE_URL, which is set on both projects and names only
  // one of them. An invitation emailed from private-attache-system.vercel.app
  // has to carry a link back to it, not to the other project's domain.
  const own = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (own) return `https://${own.replace(/\/$/, "")}`;

  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configured) return configured.replace(/\/$/, "");

  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) return `https://${vercel.replace(/\/$/, "")}`;

  return `https://${PRODUCTION_HOST}`;
}

/**
 * Where a link that will be *emailed to someone else* should point.
 *
 * `siteUrl()` answers "where am I", which on a dev machine is localhost — and
 * that is right for a sign-in redirect, which must come back to the browser
 * that started it. It is wrong for an invitation: the person opening that link
 * is a client on their own machine, and localhost is their machine, not yours.
 *
 * So an invitation sent while testing locally arrives pointing at
 * http://localhost:3000 and the client cannot open it. Set
 * INVITE_LINK_ORIGIN in `.env.local` to the deployed URL and outgoing
 * invitations carry that instead, while every other local redirect — Google
 * sign-in, the auth callback, password reset — stays on localhost and keeps
 * working.
 *
 * Unset everywhere else, so on Vercel this is simply `siteUrl()`.
 */
export function inviteOrigin() {
  const configured = process.env.INVITE_LINK_ORIGIN?.trim();
  if (configured) return configured.replace(/\/$/, "");
  return siteUrl();
}

export function requestOrigin(_request?: Request) {
  return siteUrl();
}

export function emailConfirmRedirect() {
  return `${siteUrl()}/auth/callback?next=/confirmed`;
}

export function passwordResetRedirect() {
  return `${siteUrl()}/auth/callback?next=/reset-password`;
}

export function postAuthPath(type: string | null, currentPath?: string) {
  // An invitation link carries its own destination in the path. Supabase sends
  // the recipient to /invite/<token> (or /partner-center/invite/<token>) with a
  // code on it, the middleware pulls that through /auth/callback, and everything
  // after the callback used to be decided by `type` alone — which for an invite
  // meant /switcher. The token was dropped on the floor and the invitation was
  // never accepted: the person simply arrived signed in, looking at a product
  // switcher, with no idea they had been invited to anything.
  if (
    currentPath?.startsWith("/invite/") ||
    currentPath?.startsWith("/partner-center/invite/") ||
    currentPath?.startsWith("/partner-center/admin")
  ) {
    return currentPath;
  }

  if (type === "recovery" || currentPath === "/reset-password") return "/reset-password";
  if (type === "signup" || type === "email") return "/confirmed";
  return "/switcher";
}
