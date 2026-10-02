import { NextResponse } from "next/server";
import { createServiceClient } from "@/base/lib/supabase/service";
import { syncGmail } from "@/client-portal/lib/integrations/gmail";
import { syncGoogleCalendar } from "@/client-portal/lib/integrations/google-calendar";
import { syncOutlookMail } from "@/client-portal/lib/integrations/outlook-mail";
import { syncOutlookCalendar } from "@/client-portal/lib/integrations/outlook-calendar";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Every client's connected mailbox and calendar, for the hours nobody has the
 * portal open — `app/api/cron/gmail-sync` for the portal side.
 *
 * The portal keeps itself current while a client uses it (the header reads
 * Gmail, the Calendar reads Google); this covers the rest of the day. Guarded
 * by `CRON_SECRET` exactly as Whitby's is, and refusing everything without it:
 * an unprotected endpoint that reads mailboxes is worse than a cron that does
 * not run.
 *
 * One person after another, not all at once — each new message is a model
 * call, and a burst across every client is how a provider starts refusing.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ ok: false, error: "CRON_SECRET is not set." }, { status: 503 });
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }

  const supabase = createServiceClient();
  if (!supabase) {
    return NextResponse.json({ ok: false, error: "Server credentials are missing." }, { status: 503 });
  }

  const { data, error } = await supabase
    .from("client_portal_integrations")
    .select("contact_id, provider, workspace_id")
    .in("provider", ["gmail", "google_calendar", "outlook_mail", "outlook_calendar"])
    .eq("status", "connected");

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  const rows = data ?? [];

  // A calendar's all-day events are placed in the zone of the account they
  // were connected on, as the portal draws every other date.
  const workspaceIds = [
    ...new Set(rows.map((row) => row.workspace_id as string | null).filter(Boolean)),
  ] as string[];
  const { data: workspaces } = workspaceIds.length
    ? await supabase.from("workspaces").select("id, timezone").in("id", workspaceIds)
    : { data: [] };
  const zoneOf = new Map(
    (workspaces ?? []).map((row) => [row.id as string, (row.timezone as string | null) || "UTC"]),
  );

  const results: { provider: string; ok: boolean; count?: number }[] = [];

  for (const row of rows) {
    const contactId = row.contact_id as string;
    try {
      const zone = zoneOf.get(row.workspace_id as string) ?? "UTC";
      const outcome =
        row.provider === "gmail"
          ? await syncGmail(contactId)
          : row.provider === "outlook_mail"
            ? await syncOutlookMail(contactId)
            : row.provider === "outlook_calendar"
              ? await syncOutlookCalendar(contactId, zone)
              : await syncGoogleCalendar(contactId, zone);
      results.push({ provider: row.provider as string, ok: outcome.ok, count: outcome.count });
    } catch {
      results.push({ provider: row.provider as string, ok: false });
    }
  }

  return NextResponse.json({ ok: true, synced: results.length, results });
}
