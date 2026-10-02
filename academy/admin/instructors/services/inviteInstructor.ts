import "server-only";

import { randomUUID } from "crypto";
import { getSessionProfile } from "@/base/identity/session";
import { canAccessAdminArea, isAcademyAdmin } from "@/academy/lib/authorization";
import { createClient } from "@/base/lib/supabase/server";
import { createAdminClient, isSupabaseAdminConfigured } from "@/base/lib/supabase/admin";
import { siteUrl } from "@/base/auth/site";
import type { InviteInstructorResult } from "../types";
import { assignInstructor } from "./assignInstructor";
import { grantInstructorRole } from "./grantInstructorRole";
import { sendInstructorInviteEmail } from "./sendInstructorInviteEmail";
import { findActiveAccountsByEmail } from "@/base/identity/lookupAccountByEmail";
import { isPlausibleEmail, normalizeEmail } from "@/base/lib/email";
import { instructorInviteExpiresAt } from "../lib/inviteExpiry";

function parseProgramPayload(programIds: string[]) {
  return JSON.stringify({
    programIds: [...new Set(programIds.map((id) => id.trim().toLowerCase()))],
    permission: "edit",
  });
}

async function loadProgramNames(programIds: string[]) {
  if (programIds.length === 0) return [] as string[];
  const supabase = await createClient();
  const { data } = await supabase
    .from("academy_programs")
    .select("id, name")
    .in("id", programIds);
  const namesById = new Map((data ?? []).map((row) => [row.id, row.name]));
  return programIds.map((id) => namesById.get(id)).filter(Boolean) as string[];
}

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

export async function inviteInstructor(input: {
  email: string;
  displayName: string;
  programIds: string[];
}): Promise<InviteInstructorResult> {
  const email = normalizeEmail(input.email);
  const displayName = input.displayName.trim() || email.split("@")[0] || "Instructor";

  if (!isPlausibleEmail(email)) {
    return { ok: false, reason: "invalid", message: "Enter a valid email address." };
  }

  try {
    const profile = await getSessionProfile();
    if (!profile) return { ok: false, reason: "unauthorized" };
    const actor = { id: profile.user.id };
    const [area, admin] = await Promise.all([canAccessAdminArea(actor), isAcademyAdmin(actor)]);
    if (!area || !admin) return { ok: false, reason: "unauthorized" };

    const programIds = [...new Set(input.programIds.map((id) => id.trim().toLowerCase()))];
    const programNames = await loadProgramNames(programIds);
    const existingUser = await findUserByEmail(email);

    if (existingUser) {
      const grant = await grantInstructorRole(existingUser.id);
      if (!grant.ok) {
        return {
          ok: false,
          reason: grant.reason === "not_found" || grant.reason === "role_conflict" ? "failed" : grant.reason,
          message: grant.message,
        };
      }

      for (const programId of programIds) {
        const assigned = await assignInstructor({
          userId: existingUser.id,
          programId,
          permission: "edit",
        });
        if (!assigned.ok && assigned.reason !== "already_assigned") {
          return {
            ok: false,
            reason: "failed",
            message: assigned.message || "Program assignments could not be saved.",
          };
        }
      }

      const mail = await sendInstructorInviteEmail({
        kind: "existing",
        email,
        displayName,
        programNames,
      });
      if (!mail.ok) {
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
        mode: "existing",
        emailSent: true,
        userId: existingUser.id,
        programNames,
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
    const expiresAt = instructorInviteExpiresAt();
    const inviteUrl = `${siteUrl()}/invite/${token}?brand=academy`;

    const { error: inviteError } = await adminClient.from("invitations").insert({
      token,
      inviter_user_id: actor.id,
      invitee_email: email,
      invitee_name: displayName,
      context_type: "academy_instructor",
      context_id: actor.id,
      role_or_relationship: parseProgramPayload(programIds),
      status: "pending",
      sent_at: new Date().toISOString(),
      expires_at: expiresAt,
      created_by: actor.id,
    });

    if (inviteError) {
      const detail = inviteError.message || "";
      const needsMigration = detail.includes("academy_instructor");
      return {
        ok: false,
        reason: "failed",
        message: needsMigration
          ? "Database migration 00023_academy_instructor_invite.sql is missing. Run supabase db push, then try again."
          : detail || "The instructor invitation could not be created.",
      };
    }

    const mail = await sendInstructorInviteEmail({
      kind: "new_account",
      email,
      displayName,
      programNames,
      inviteUrl,
    });

    if (!mail.ok) {
      await adminClient
        .from("invitations")
        .update({ status: "revoked" })
        .eq("token", token);
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
      programNames,
    };
  } catch {
    return {
      ok: false,
      reason: "failed",
      message: "The instructor invitation could not be sent.",
    };
  }
}
