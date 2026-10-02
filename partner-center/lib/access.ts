import { cache } from "react";
import { redirect } from "next/navigation";
import { getSessionProfile } from "@/base/identity/session";
import { isSupabaseConfigured } from "@/base/lib/supabase/server";
import type { Entitlement, User } from "@/base/types";
import { partnerTeamInvitePath } from "@/partner-center/lib/invite-url";
import { findPendingPartnerTeamInviteToken } from "@/partner-center/lib/pending-team-invite";
import { PARTNER_PATHS, partnerFlowPath } from "@/partner-center/lib/review-state";
import { resolvePartner } from "@/partner-center/lib/resolve-partner";
import { isAdminAccess } from "@/partner-center/team/lib/labels";
import type { PartnerContext, PartnerTeamFunction } from "@/partner-center/types/partner";

const LOGIN_PATH = "/partner-center/signin";
const SWITCHER_PATH = "/switcher";

export type PartnerAccess = {
  user: User;
  context: PartnerContext | null;
};

function previewUser(): User {
  return {
    id: "preview",
    email: "",
    password_hash: null,
    oauth_provider: null,
    oauth_id: null,
    full_name: "You",
    preferred_name: null,
    salutation: null,
    phone: null,
    title_role: null,
    avatar_url: null,
    timezone: "UTC",
    tour_seen_at: null,
    status: "active",
    last_login_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

function sendToFlow(context: PartnerContext | null, allowed: string[]) {
  const destination = partnerFlowPath(context);
  if (!allowed.includes(destination)) redirect(destination);
}

/** Deduped per request when layout + page both gate access. */
export const requirePartnerSession = cache(
  async (): Promise<PartnerAccess> => {
    if (!isSupabaseConfigured()) {
      return { user: previewUser(), context: null };
    }

    const session = await getSessionProfile();
    if (!session) redirect(LOGIN_PATH);

    // Active or invited Partner Admin with no partner profile → admin shell.
    // Same idea as Company & Team: staff never enter Apply / onboarding.
    const { getActivePartnerAdmin } = await import(
      "@/partner-center/admin/lib/require-partner-admin"
    );
    const { resolvePartnerAdminPostAuthLanding } = await import(
      "@/partner-center/admin/lib/invite"
    );
    let partnerAdmin = await getActivePartnerAdmin();
    if (!partnerAdmin && session.user.email) {
      const adminLanding = await resolvePartnerAdminPostAuthLanding({
        userId: session.user.id,
        email: session.user.email,
      });
      if (adminLanding) {
        partnerAdmin = await getActivePartnerAdmin();
      }
    }
    if (partnerAdmin) {
      const entitledEarly = session.entitlements.some(
        (item: Entitlement) =>
          item.product === "partner_center" &&
          (item.status === "active" || item.status === "trial"),
      );
      const contextEarly = entitledEarly
        ? await resolvePartner(session.user, session.entitlements)
        : null;
      if (!contextEarly?.profile) {
        redirect("/partner-center/admin");
      }
    }

    const entitled = session.entitlements.some(
      (item: Entitlement) =>
        item.product === "partner_center" &&
        (item.status === "active" || item.status === "trial"),
    );

    const context = entitled
      ? await resolvePartner(session.user, session.entitlements)
      : null;

    // Pending Company & Team invite beats Apply / application onboarding.
    if (!context?.teamMember) {
      const inviteToken = await findPendingPartnerTeamInviteToken(
        session.user.email,
      );
      if (inviteToken) redirect(partnerTeamInvitePath(inviteToken));
    }

    if (!entitled) redirect(SWITCHER_PATH);

    return { user: session.user, context };
  },
);

const PRIVILEGED_FUNCTIONS = new Set<PartnerTeamFunction>([
  "company_admin",
  "billing_payment_contact",
]);

export function isPrivilegedPartner(context: PartnerContext | null): boolean {
  if (!context?.profile) return false;
  const { teamMember, contact, profile } = context;

  if (teamMember) {
    const { access_level: accessLevel, function: fn } = teamMember;
    if (accessLevel === "read_only") return false;
    if (isAdminAccess(accessLevel)) return true;
    return PRIVILEGED_FUNCTIONS.has(fn as PartnerTeamFunction);
  }

  // Primary contact during checklist onboarding may not have a team row yet.
  if (contact && profile.primary_contact_id === contact.id) {
    return true;
  }

  return false;
}

export type PartnerPrivilegedAccess = PartnerAccess & {
  privileged: boolean;
};

/** Tax/payout setup — admin access level or billing/company-admin function (SRS 17.10.3–4). */
export async function requirePartnerPrivilegedAccess(): Promise<PartnerPrivilegedAccess> {
  const access = await requirePartnerSession();
  return {
    ...access,
    privileged: isPrivilegedPartner(access.context),
  };
}

export async function requirePartnerOnboardingAccess(): Promise<PartnerAccess> {
  const access = await requirePartnerSession();
  sendToFlow(access.context, [PARTNER_PATHS.onboarding]);
  return access;
}

export async function requirePartnerPendingAccess(): Promise<PartnerAccess> {
  const access = await requirePartnerSession();
  sendToFlow(access.context, [PARTNER_PATHS.pending]);
  return access;
}

export async function requirePartnerMoreInfoAccess(): Promise<PartnerAccess> {
  const access = await requirePartnerSession();
  sendToFlow(access.context, [PARTNER_PATHS.moreInfo]);
  return access;
}

export async function requirePartnerDeclinedAccess(): Promise<PartnerAccess> {
  const access = await requirePartnerSession();
  sendToFlow(access.context, [PARTNER_PATHS.declined]);
  return access;
}

export async function requirePartnerApprovedAccess(): Promise<PartnerAccess> {
  const access = await requirePartnerSession();
  sendToFlow(access.context, [PARTNER_PATHS.approved]);
  return access;
}

export async function requirePartnerChecklistAccess(): Promise<PartnerAccess> {
  const access = await requirePartnerSession();
  sendToFlow(access.context, [PARTNER_PATHS.checklist]);
  return access;
}

export async function requirePartnerAppAccess(): Promise<PartnerAccess> {
  const access = await requirePartnerSession();
  sendToFlow(access.context, [PARTNER_PATHS.app]);
  return access;
}

/** Settings → Tax — active partners only; approved applicants use onboarding tax/payout. */
export async function requirePartnerTaxSettingsAccess(): Promise<PartnerAccess> {
  const access = await requirePartnerSession();
  sendToFlow(access.context, [PARTNER_PATHS.app]);
  return access;
}
