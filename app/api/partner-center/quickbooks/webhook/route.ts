import { createHmac, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import {
  createAdminClient,
  isSupabaseAdminConfigured,
} from "@/base/lib/supabase/admin";
import { handleQuickBooksInvoiceChanged } from "@/partner-center/lib/attribution/quickbooks-invoice-changed";
import { handleQuickBooksPaymentCreated } from "@/partner-center/lib/attribution/quickbooks-payment-created";
import { intuitWebhookVerifier } from "@/partner-center/lib/quickbooks/config";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type QbEntity = {
  name?: string;
  id?: string;
  operation?: string;
  lastUpdated?: string;
};

type QbNotification = {
  realmId?: string;
  dataChangeEvent?: {
    entities?: QbEntity[];
  };
};

function verifyIntuitSignature(rawBody: string, signature: string | null): boolean {
  const verifier = intuitWebhookVerifier();
  if (!verifier || !signature) return false;

  const hash = createHmac("sha256", verifier).update(rawBody).digest("base64");
  const expected = Buffer.from(hash);
  const received = Buffer.from(signature);
  if (expected.length !== received.length) return false;
  return timingSafeEqual(expected, received);
}

async function claimEvent(
  supabase: ReturnType<typeof createAdminClient>,
  eventId: string,
): Promise<"claimed" | "duplicate" | { error: string }> {
  const { error } = await supabase.from("partner_qb_webhook_events").insert({
    id: eventId,
  });
  if (!error) return "claimed";
  if (error.code === "23505") return "duplicate";
  return { error: error.message };
}

async function processEntity(
  supabase: ReturnType<typeof createAdminClient>,
  entity: QbEntity,
  realmId: string | null,
  results: Array<Record<string, unknown>>,
): Promise<NextResponse | null> {
  const name = entity.name;
  if (name !== "Payment" && name !== "Invoice") return null;
  if (!entity.id) return null;

  const operation = (entity.operation ?? "").toLowerCase();
  if (operation && operation !== "create" && operation !== "update") {
    return null;
  }

  const eventId = [
    realmId ?? "unknown",
    name,
    entity.id,
    entity.operation ?? "Create",
    entity.lastUpdated ?? "",
  ].join(":");

  const claim = await claimEvent(supabase, eventId);
  if (claim === "duplicate") {
    results.push({ eventId, duplicate: true });
    return null;
  }
  if (typeof claim === "object") {
    return NextResponse.json({ error: claim.error }, { status: 500 });
  }

  try {
    const result =
      name === "Payment"
        ? await handleQuickBooksPaymentCreated(supabase, {
            paymentId: entity.id,
            realmId,
          })
        : await handleQuickBooksInvoiceChanged(supabase, {
            invoiceId: entity.id,
            realmId,
          });

    if (!result.ok && !result.skipped) {
      await supabase.from("partner_qb_webhook_events").delete().eq("id", eventId);
      return NextResponse.json({ error: result.error }, { status: 500 });
    }
    results.push({ eventId, result });
  } catch (caught) {
    await supabase.from("partner_qb_webhook_events").delete().eq("id", eventId);
    const message =
      caught instanceof Error ? caught.message : "Webhook handler failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return null;
}

export async function POST(request: Request) {
  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json(
      { error: "Supabase admin is not configured." },
      { status: 503 },
    );
  }

  const verifier = intuitWebhookVerifier();
  if (!verifier) {
    return NextResponse.json(
      { error: "INTUIT_WEBHOOK_VERIFIER_TOKEN is not set." },
      { status: 503 },
    );
  }

  const rawBody = await request.text();
  const signature = request.headers.get("intuit-signature");
  if (!verifyIntuitSignature(rawBody, signature)) {
    return NextResponse.json({ error: "Invalid signature." }, { status: 401 });
  }

  let payload: { eventNotifications?: QbNotification[] };
  try {
    payload = JSON.parse(rawBody) as { eventNotifications?: QbNotification[] };
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const supabase = createAdminClient();
  const results: Array<Record<string, unknown>> = [];

  for (const notification of payload.eventNotifications ?? []) {
    const realmId = notification.realmId ?? null;
    for (const entity of notification.dataChangeEvent?.entities ?? []) {
      const early = await processEntity(supabase, entity, realmId, results);
      if (early) return early;
    }
  }

  return NextResponse.json({ received: true, results });
}
