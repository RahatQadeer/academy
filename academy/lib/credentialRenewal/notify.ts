import "server-only";

import { siteUrl } from "@/base/auth/site";
import { createClient } from "@/base/lib/supabase/server";
import { createAdminClient, isSupabaseAdminConfigured } from "@/base/lib/supabase/admin";

async function sendAdminEmail(input: {
  to: string[];
  subject: string;
  text: string;
}): Promise<"resend" | "log"> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from =
    process.env.RESEND_FROM_EMAIL?.trim() || "Private Attaché Academy <onboarding@resend.dev>";

  if (!apiKey || input.to.length === 0) {
    console.info("[academy] renewal admin notice", {
      to: input.to,
      subject: input.subject,
    });
    return "log";
  }

  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: input.to,
        subject: input.subject,
        text: input.text,
      }),
    });
  } catch (error) {
    console.error("[academy] renewal admin email failed", error);
  }
  return "resend";
}

export async function notifyAdminsOfRenewalRequest(input: {
  renewalRequestId: string;
  credentialId: string;
  learnerName: string;
  programName: string;
}): Promise<void> {
  const href = `/academy/admin/credentials/renewals/${input.renewalRequestId}`;
  const title = "Certificate renewal requested";
  const body = `${input.learnerName} requested renewal for ${input.programName}.`;

  const supabase = await createClient();
  await supabase.from("academy_admin_notifications").insert({
    kind: "credential_renewal_request",
    title,
    body,
    href,
    credential_id: input.credentialId,
    renewal_request_id: input.renewalRequestId,
  });

  if (!isSupabaseAdminConfigured()) return;
  const admin = createAdminClient();
  if (!admin) return;

  const { data: memberships } = await admin
    .from("academy_memberships")
    .select("user_id")
    .eq("role", "admin")
    .eq("status", "active");

  const userIds = ((memberships ?? []) as { user_id: string }[]).map((row) => row.user_id);
  if (userIds.length === 0) return;

  const { data: users } = await admin.from("users").select("email").in("id", userIds);
  const emails = ((users ?? []) as { email: string | null }[])
    .map((row) => row.email?.trim())
    .filter((email): email is string => Boolean(email));

  await sendAdminEmail({
    to: emails,
    subject: title,
    text: [
      body,
      "",
      `Review and choose a renewal path: ${siteUrl()}${href}`,
      "",
      "— Private Attaché Academy",
    ].join("\n"),
  });
}

export async function notifyLearnerRenewalUpdate(input: {
  to: string | null | undefined;
  learnerName: string;
  programName: string;
  subject: string;
  detail: string;
  href: string;
}): Promise<void> {
  const email = input.to?.trim();
  if (!email) return;

  await sendAdminEmail({
    to: [email],
    subject: input.subject,
    text: [
      `Hi ${input.learnerName},`,
      "",
      input.detail,
      "",
      `Continue here: ${siteUrl()}${input.href}`,
      "",
      "— Private Attaché Academy",
    ].join("\n"),
  });
}
