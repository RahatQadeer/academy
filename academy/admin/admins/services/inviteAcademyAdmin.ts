import "server-only";

import { randomUUID } from "crypto";
import { siteUrl } from "@/base/auth/site";
import { findActiveAccountsByEmail } from "@/base/identity/lookupAccountByEmail";
import { isPlausibleEmail, normalizeEmail } from "@/base/lib/email";
import { createAdminClient, isSupabaseAdminConfigured } from "@/base/lib/supabase/admin";
import { adminInviteExpiresAt } from "../lib/inviteExpiry";
import type { InviteAcademyAdminResult } from "../types";
import { grantAcademyAdmin } from "./grantAcademyAdmin";
import { requireAcademySuperAdminActor } from "./requireSuperAdmin";
import { sendAdminInviteEmail } from "./sendAdminInviteEmail";

async function findUserByEmail(email: string) {
  const accounts = await findActiveAccountsByEmail(email);
  const match = accounts[0];
  if (!match) return null;
  if (!isSupabaseAdminConfigured()) {
    return { id: match.id, email: match.email, full_name: "", preferred_name: null };
  }
  const admin = createAdminClient();
  const { data } = await admin
    .from("users")
    .select("id, email, full_name, preferred_name")
    .eq("id", match.id)
    .maybeSingle();
  return data as
    | { id: string; email: string; full_name: string; preferred_name: string | null }
    | null;
}

export async function inviteAcademyAdmin(input: {
  email: string;
  displayName: string;
}): Promise<InviteAcademyAdminResult> {
  const email = normalizeEmail(input.email);
  const displayName = input.displayName.trim() || email.split("@")[0] || "Admin";

  if (!isPlausibleEmail(email)) {
    return { ok: false, reason: "invalid", message: "Enter a valid email address." };
  }

  try {
    const actor = await requireAcademySuperAdminActor();
    if (!actor.ok) return { ok: false, reason: "unauthorized" };

    const existingUser = await findUserByEmail(email);

    if (existingUser) {
      const grant = await grantAcademyAdmin(existingUser.id);
      if (!grant.ok) {
        return {
          ok: false,
          reason:
            grant.reason === "not_found" || grant.reason === "role_conflict"
              ? "failed"
              : grant.reason,
          message: grant.message,
        };
      }

      const mail = await sendAdminInviteEmail({
        kind: "existing",
        email,
        displayName,
      });
      // Access is already granted — never report total failure if mail fails.
      return {
        ok: true,
        displayName,
        email,
        mode: "existing",
        emailSent: mail.ok,
        userId: existingUser.id,
        message: mail.ok
          ? undefined
          : mail.message || "Admin access was granted, but the notification email could not be sent.",
      };
    }

    if (!isSupabaseAdminConfigured()) {
      return {
        ok: false,
        reason: "failed",
        message: "Server email configuration is missing. Add SUPABASE_SERVICE_ROLE_KEY.",
      };
    }

    const adminClient = createAdminClient();
    const token = randomUUID();
    const expiresAt = adminInviteExpiresAt();
    const inviteUrl = `${siteUrl()}/invite/${token}?brand=academy`;

    const { error: inviteError } = await adminClient.from("invitations").insert({
      token,
      inviter_user_id: actor.userId,
      invitee_email: email,
      invitee_name: displayName,
      context_type: "academy_admin",
      context_id: actor.userId,
      role_or_relationship: "admin",
      status: "pending",
      sent_at: new Date().toISOString(),
      expires_at: expiresAt,
      created_by: actor.userId,
    });

    if (inviteError) {
      const detail = inviteError.message || "";
      const needsMigration = detail.includes("academy_admin");
      return {
        ok: false,
        reason: "failed",
        message: needsMigration
          ? "Database migration 00067_academy_admin_invite.sql is missing. Run supabase db push, then try again."
          : detail || "The admin invitation could not be created.",
      };
    }

    const mail = await sendAdminInviteEmail({
      kind: "new_account",
      email,
      displayName,
      inviteUrl,
    });

    if (!mail.ok) {
      await adminClient.from("invitations").update({ status: "revoked" }).eq("token", token);
      return {
        ok: false,
        reason: "email_failed",
        message: mail.message,
      };
    }

    return {
      ok: true,
      displayName,
      email,
      mode: "invited",
      emailSent: true,
      userId: null,
    };
  } catch {
    return {
      ok: false,
      reason: "failed",
      message: "The admin invitation could not be sent.",
    };
  }
}
