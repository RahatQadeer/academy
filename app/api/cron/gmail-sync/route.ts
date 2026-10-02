import { NextResponse } from "next/server";
import { createServiceClient } from "@/base/lib/supabase/service";
import { GMAIL_PROVIDER } from "@/whitbyos/lib/gmail";
import { syncGmailContext } from "@/whitbyos/lib/gmail-sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Read every connected mailbox, for the hours nobody has the product open.
 *
 * Whitby's header already syncs after each page it renders, which covers a
 * professional who is working. This covers the rest of the day: mail that
 * arrives overnight is summarised and its bell is waiting in the morning
 * rather than being read only once somebody happens to sign in.
 *
 * Session-less on purpose — there is no user behind a cron — so it runs on the
 * service role and is guarded by a shared secret instead. Vercel Cron sends
 * `Authorization: Bearer $CRON_SECRET` on its own once that variable is set on
 * the project. With no secret configured the route refuses everything, which
 * is the right way round: an unprotected endpoint that reads mailboxes is
 * worse than a cron that does not run.
 *
 * Workspaces are synced one after another rather than at once. Each one costs
 * a model call per new message, and a burst of them across every workspace is
 * how a provider starts refusing.
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
    return NextResponse.json(
      { ok: false, error: "Server credentials are missing." },
      { status: 503 },
    );
  }

  const { data: rows } = await supabase
    .from("whitbyos_integrations")
    .select("workspace_id")
    .eq("provider", GMAIL_PROVIDER)
    .eq("status", "connected");

  const workspaceIds = [
    ...new Set((rows ?? []).map((row) => row.workspace_id as string).filter(Boolean)),
  ];

  let synced = 0;
  let processed = 0;
  const failed: string[] = [];

  for (const workspaceId of workspaceIds) {
    const result = await syncGmailContext(workspaceId);
    if (result.ok) {
      synced += 1;
      processed += result.count ?? 0;
    } else {
      // The sync has already marked this one `needs_attention`; the count is
      // what the run reports.
      failed.push(workspaceId);
    }
  }

  return NextResponse.json({
    ok: true,
    workspaces: workspaceIds.length,
    synced,
    processed,
    failed: failed.length,
  });
}
