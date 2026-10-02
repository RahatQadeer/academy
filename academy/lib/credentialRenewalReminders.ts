import "server-only";

import { createAdminClient, isSupabaseAdminConfigured } from "@/base/lib/supabase/admin";
import { siteUrl } from "@/base/auth/site";

export const CREDENTIAL_RENEWAL_REMINDER_DAYS = [90, 60, 30] as const;
export type CredentialRenewalReminderDays = (typeof CREDENTIAL_RENEWAL_REMINDER_DAYS)[number];

type CredentialCandidate = {
  id: string;
  user_id: string;
  expires_at: string;
  academy_programs: { name: string } | { name: string }[] | null;
};

type UserRow = {
  id: string;
  email: string | null;
  full_name: string | null;
  preferred_name: string | null;
};

export type RenewalReminderRunResult = {
  ok: true;
  scanned: number;
  sent: number;
  recorded: number;
  skipped: number;
  failed: number;
};

function programName(row: CredentialCandidate) {
  const program = Array.isArray(row.academy_programs)
    ? row.academy_programs[0]
    : row.academy_programs;
  return program?.name?.trim() || "your Academy credential";
}

function displayName(user: UserRow) {
  return (
    user.preferred_name?.trim() ||
    user.full_name?.trim() ||
    user.email?.split("@")[0] ||
    "there"
  );
}

function startOfUtcDay(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function addUtcDays(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

async function sendRenewalEmail(input: {
  to: string;
  learnerName: string;
  programName: string;
  daysBefore: CredentialRenewalReminderDays;
  expiresAt: string;
}): Promise<{ ok: true; channel: "resend" | "log" } | { ok: false; message: string }> {
  const expiresLabel = new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(input.expiresAt));
  const credentialsUrl = `${siteUrl()}/academy/credentials`;
  const subject = `Renewal reminder: ${input.programName} expires in ${input.daysBefore} days`;
  const text = [
    `Hi ${input.learnerName},`,
    "",
    `Your credential for ${input.programName} expires on ${expiresLabel} (${input.daysBefore} days from now).`,
    "",
    `Review your credentials and renewal options: ${credentialsUrl}`,
    "",
    "— Private Attaché Academy",
  ].join("\n");

  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from =
    process.env.RESEND_FROM_EMAIL?.trim() || "Private Attaché Academy <onboarding@resend.dev>";

  if (!apiKey) {
    console.info("[academy] credential renewal reminder (no RESEND_API_KEY)", {
      to: input.to,
      subject,
      daysBefore: input.daysBefore,
    });
    return { ok: true, channel: "log" };
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [input.to],
        subject,
        text,
      }),
    });
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      return { ok: false, message: body || `Resend HTTP ${response.status}` };
    }
    return { ok: true, channel: "resend" };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Email send failed",
    };
  }
}

/**
 * Daily job: for awarded credentials with expires_at, send (or record) reminders
 * at 90 / 60 / 30 days before expiry. Deduped via academy_credential_renewal_reminders.
 */
export async function runCredentialRenewalReminders(
  now = new Date(),
): Promise<RenewalReminderRunResult | { ok: false; message: string }> {
  if (!isSupabaseAdminConfigured()) {
    return { ok: false, message: "Supabase admin is not configured." };
  }

  const admin = createAdminClient();
  const today = startOfUtcDay(now);
  let scanned = 0;
  let sent = 0;
  let recorded = 0;
  let skipped = 0;
  let failed = 0;

  for (const daysBefore of CREDENTIAL_RENEWAL_REMINDER_DAYS) {
    const windowStart = addUtcDays(today, daysBefore);
    const windowEnd = addUtcDays(windowStart, 1);

    const { data: credentials, error } = await admin
      .from("academy_credentials")
      .select("id, user_id, expires_at, academy_programs ( name )")
      .eq("status", "awarded")
      .not("expires_at", "is", null)
      .gte("expires_at", windowStart.toISOString())
      .lt("expires_at", windowEnd.toISOString());

    if (error) {
      return { ok: false, message: error.message };
    }

    const rows = (credentials ?? []) as CredentialCandidate[];
    scanned += rows.length;
    if (rows.length === 0) continue;

    const credentialIds = rows.map((row) => row.id);
    const { data: alreadySent } = await admin
      .from("academy_credential_renewal_reminders")
      .select("credential_id")
      .eq("days_before", daysBefore)
      .in("credential_id", credentialIds);

    const sentSet = new Set(
      ((alreadySent ?? []) as { credential_id: string }[]).map((row) => row.credential_id),
    );

    const userIds = [...new Set(rows.map((row) => row.user_id))];
    const { data: users } = await admin
      .from("users")
      .select("id, email, full_name, preferred_name")
      .in("id", userIds);
    const usersById = new Map(((users ?? []) as UserRow[]).map((user) => [user.id, user]));

    for (const row of rows) {
      if (sentSet.has(row.id)) {
        skipped += 1;
        continue;
      }

      const user = usersById.get(row.user_id);
      const email = user?.email?.trim();
      if (!user || !email) {
        skipped += 1;
        continue;
      }

      const mail = await sendRenewalEmail({
        to: email,
        learnerName: displayName(user),
        programName: programName(row),
        daysBefore,
        expiresAt: row.expires_at,
      });

      if (!mail.ok) {
        failed += 1;
        continue;
      }

      const { error: insertError } = await admin.from("academy_credential_renewal_reminders").insert({
        credential_id: row.id,
        days_before: daysBefore,
        channel: mail.channel === "resend" ? "email" : "log",
        status: mail.channel === "resend" ? "sent" : "recorded",
      });

      if (insertError) {
        // Unique race — treat as already handled.
        if (insertError.code === "23505") {
          skipped += 1;
          continue;
        }
        failed += 1;
        continue;
      }

      if (mail.channel === "resend") sent += 1;
      else recorded += 1;
    }
  }

  return { ok: true, scanned, sent, recorded, skipped, failed };
}
