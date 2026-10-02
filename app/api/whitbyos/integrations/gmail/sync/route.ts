import { NextResponse } from "next/server";
import { getCurrentWorkspaceId } from "@/whitbyos/lib/workspace";
import { syncGmailContext } from "@/whitbyos/lib/gmail-sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Pull incoming Gmail for the current workspace's approved senders.
 *
 * Session-scoped, not a public webhook: Gmail push would need a Pub/Sub
 * topic this deployment does not have. Screen 16 and Ask Whitby already
 * call the same function; this route is for a later cron or a manual retry.
 */
export async function POST() {
  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) {
    return NextResponse.json({ ok: false, message: "No workspace is open." }, { status: 401 });
  }

  const result = await syncGmailContext(workspaceId);
  if (!result.ok) {
    return NextResponse.json({ ok: false, message: result.error }, { status: 409 });
  }

  return NextResponse.json({ ok: true, processed: result.count ?? 0 });
}
