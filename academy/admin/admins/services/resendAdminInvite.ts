import "server-only";

import { randomUUID } from "crypto";
import { siteUrl } from "@/base/auth/site";
import { createAdminClient, isSupabaseAdminConfigured } from "@/base/lib/supabase/admin";
import { adminInviteExpiresAt } from "../lib/inviteExpiry";
import type { InviteAcademyAdminResult } from "../types";
import { requireAcademySuperAdminActor } from "./requireSuperAdmin";
import { sendAdminInviteEmail } from "./sendAdminInviteEmail";

export async function resendAdminInvite(input: {
  email: string;
  displayName: string;
}): Promise<InviteAcademyAdminResult> {
  const email = input.email.trim().toLowerCase();
  const displayName = input.displayName.trim() || email.split("@")[0] || "Admin";

  try {
    const actor = await requireAcademySuperAdminActor();
    if (!actor.ok) return { ok: false, reason: "unauthorized" };

    if (!isSupabaseAdminConfigured()) {
      return {
        ok: false,
        reason: "failed",
        message: "Server email configuration is missing.",
      };
    }

    const adminClient = createAdminClient();
    const { data: existingUser } = await adminClient
      .from("users")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    if (existingUser) {
      return {
        ok: false,
        reason: "failed",
        message:
          "This person already has an account. Resend is only for invites that have not been accepted yet.",
      };
    }

    const { data: pendingInvite } = await adminClient
      .from("invitations")
      .select("id, token, invitee_name, invitee_email")
      .eq("context_type", "academy_admin")
      .in("status", ["pending", "expired"])
      .order("created_at", { ascending: false })
      .limit(100);

    const match = ((pendingInvite ?? []) as {
      id: string;
      token: string;
      invitee_name: string | null;
      invitee_email: string;
    }[]).find((row) => row.invitee_email.trim().toLowerCase() === email);

    if (!match?.id) {
      return {
        ok: false,
        reason: "failed",
        message: "No pending admin invitation found for this email.",
      };
    }

    const token = randomUUID();
    const expiresAt = adminInviteExpiresAt();
    const previousToken = match.token;
    const { error: updateError } = await adminClient
      .from("invitations")
      .update({
        token,
        status: "pending",
        sent_at: new Date().toISOString(),
        expires_at: expiresAt,
      })
      .eq("id", match.id);

    if (updateError) {
      return { ok: false, reason: "failed", message: "The invite could not be renewed." };
    }

    const inviteUrl = `${siteUrl()}/invite/${token}?brand=academy`;
    const mail = await sendAdminInviteEmail({
      kind: "new_account",
      email,
      displayName: match.invitee_name || displayName,
      inviteUrl,
    });

    if (!mail.ok) {
      // Restore the previous token so the earlier invite link still works.
      await adminClient
        .from("invitations")
        .update({ token: previousToken })
        .eq("id", match.id);
      return { ok: false, reason: "email_failed", message: mail.message };
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
      message: "The invite email could not be sent.",
    };
  }
}
