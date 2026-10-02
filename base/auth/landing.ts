import type { SupabaseClient } from "@supabase/supabase-js";
import { isAcademyNext } from "@/base/auth/query";
import { normalizeEmail } from "@/base/lib/email";
import { whitbyEntryPath } from "@/base/switcher/products";
import type { Workspace } from "@/base/types";

/** Invitation kinds that lead into the Client Portal rather than Whitby. */
export const CLIENT_INVITE_KINDS = ["client_member", "client_authorized_user"] as const;

/**
 * Where a person belongs once they are signed in.
 *
 * `/switcher` is the shell's "choose where to continue". A client who has just
 * accepted an invitation is sent straight into the portal — there is nothing
 * to choose yet. Later visits (sign-in, a password change) land on the
 * switcher so they open Client Portal from there, rather than Whitby's
 * organisation overview, which is not theirs.
 *
 * `client_portal_identities` is the record that says an auth user is a client:
 * the accept-invite flow writes it, and the portal reads it to find whose
 * account this is.
 */
export async function clientPortalLanding(
  supabase: SupabaseClient,
  userId: string | null | undefined,
): Promise<string | null> {
  if (!(await hasClientIdentity(supabase, userId))) return null;
  return "/client-portal";
}

export async function hasClientIdentity(
  supabase: SupabaseClient,
  userId: string | null | undefined,
): Promise<boolean> {
  if (!userId) return false;
  const { data } = await supabase
    .from("client_portal_identities")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();
  return Boolean(data);
}

/**
 * This address is a client's, not a professional's to bootstrap.
 *
 * Invite links sign the person in before they accept, and login/callback used
 * to create a Whitby workspace for every session. The client then landed on
 * the organisation overview — Create Client Workspace and all — instead of
 * the portal they were invited to.
 */
export async function isClientAudience(
  userId: string | null | undefined,
  email?: string | null,
): Promise<boolean> {
  if (!userId) return false;

  try {
    const { createAdminClient, isSupabaseAdminConfigured } = await import(
      "@/base/lib/supabase/admin"
    );
    if (!isSupabaseAdminConfigured()) return false;
    const admin = createAdminClient();

    const { data: identity } = await admin
      .from("client_portal_identities")
      .select("user_id")
      .eq("user_id", userId)
      .maybeSingle();
    if (identity) return true;

    const address = normalizeEmail(email);
    if (!address) return false;

    const { data: invite } = await admin
      .from("invitations")
      .select("id")
      .ilike("invitee_email", address)
      .in("context_type", [...CLIENT_INVITE_KINDS])
      .in("status", ["pending", "accepted"])
      .limit(1)
      .maybeSingle();

    return Boolean(invite);
  } catch {
    return false;
  }
}

/** A workspace this person set up as a professional, or joined as staff. */
export function hasProfessionalWorkspace(
  workspaces: Workspace[],
  userId: string | null | undefined,
): boolean {
  if (!userId) return false;
  return workspaces.some(
    (workspace) => workspace.owner_user_id !== userId || Boolean(workspace.team_size),
  );
}

/**
 * Invited as a client and never set up Whitby. They must not enter the
 * professional organisation overview.
 */
export function isPortalOnlyClient(
  isClient: boolean,
  workspaces: Workspace[],
  userId: string | null | undefined,
): boolean {
  return isClient && !hasProfessionalWorkspace(workspaces, userId);
}

type AcademyMembershipRow = {
  role: "learner" | "instructor" | "admin" | "super_admin";
  status: string;
};

/**
 * Academy staff (instructor / admin / super_admin) should land in their surface, not the
 * product switcher. Same idea as `clientPortalLanding`: one role, one place.
 *
 * Returns null for learners and for accounts with no Academy membership so
 * generic sign-in still goes to `/switcher` when nothing more specific fits.
 * Academy-branded sign-in (`next=/academy`) keeps `/academy` via
 * `resolvePostAuthLanding` even when this returns null.
 */
export async function academyRoleLanding(
  supabase: SupabaseClient,
  userId: string | null | undefined,
): Promise<string | null> {
  if (!userId) return null;

  const { data } = await supabase
    .from("academy_memberships")
    .select("role, status")
    .eq("user_id", userId)
    .eq("status", "active");

  const roles = new Set(
    ((data ?? []) as AcademyMembershipRow[]).map((row) => row.role),
  );

  if (roles.has("super_admin") || roles.has("admin")) return "/academy/admin";
  if (roles.has("instructor")) return "/academy/instructor";
  return null;
}

/** Paths that mean "no preference" — role landings may replace them. */
export function isGenericPostAuthNext(path: string | null | undefined): boolean {
  if (!path) return true;
  const pathname = path.split("?")[0] || "";
  return pathname === "/" || pathname === "/switcher" || pathname === "/academy";
}

/**
 * Single post-sign-in destination.
 *
 * Priority: an explicit non-generic `next` → client portal → Partner Admin →
 * Academy staff surface → Academy home when the sign-in was Academy-branded →
 * switcher.
 *
 * Treating `/academy` as generic lets instructors upgrade to
 * `/academy/instructor`, but must not send learners to the switcher.
 */
export async function resolvePostAuthLanding(
  supabase: SupabaseClient,
  userId: string | null | undefined,
  requestedNext?: string | null,
): Promise<string> {
  const requestedRaw = requestedNext ? whitbyEntryPath(requestedNext) : "";
  const academyIntent = isAcademyNext(requestedRaw);
  const requested = isGenericPostAuthNext(requestedRaw) ? "" : requestedRaw;

  if (requested) return requested;

  const portal = await clientPortalLanding(supabase, userId);
  if (portal) return portal;

  try {
    if (userId) {
      const { data: authUser } = await supabase.auth.getUser();
      const { resolvePartnerAdminPostAuthLanding } = await import(
        "@/partner-center/admin/lib/post-auth-landing"
      );
      const partnerAdmin = await resolvePartnerAdminPostAuthLanding({
        userId,
        email: authUser.user?.email,
      });
      if (partnerAdmin) return partnerAdmin;
    }
  } catch {
    // Partner Admin landing is best-effort.
  }

  const academy = await academyRoleLanding(supabase, userId);
  if (academy) return academy;

  if (academyIntent) return "/academy";
  return "/switcher";
}
