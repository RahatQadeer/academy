import { siteUrl } from "@/base/auth/site";

/** Partner Center team invite accept screen (partner-local, no /app/invite). */
export function partnerTeamInvitePath(token: string) {
  return `/partner-center/invite/${token}`;
}

export function partnerTeamInviteUrl(token: string) {
  return `${siteUrl()}${partnerTeamInvitePath(token)}`;
}

/**
 * Supabase invite email redirect. Goes through /auth/callback so the session is
 * established server-side and the user lands on the invite page without the
 * root hash handler bouncing them to /partner-center or /switcher.
 */
export function partnerTeamInviteEmailRedirect(token: string) {
  const next = partnerTeamInvitePath(token);
  return `${siteUrl()}/auth/callback?next=${encodeURIComponent(next)}`;
}
