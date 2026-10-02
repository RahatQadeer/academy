import type { SupabaseClient } from "@supabase/supabase-js";
import { loadPlatformAttributionConfig } from "@/super-admin/partner-center/services/platform-attribution-config";

/**
 * Inbound FirstPromoter webhook handler.
 * Ensures Whitby identity attribution only when first-touch slot is empty.
 * Never creates earnings from FP alone.
 */

export type FirstPromoterWebhookResult = {
  ok: boolean;
  skipped?: boolean;
  reason?: string;
  error?: string;
};

function extractPromoterId(data: Record<string, unknown>): string | null {
  const promoter = data.promoter as Record<string, unknown> | undefined;
  if (promoter && typeof promoter.id === "number") return String(promoter.id);
  if (promoter && typeof promoter.id === "string") return promoter.id;
  if (typeof data.promoter_id === "string") return data.promoter_id;
  if (typeof data.promoter_id === "number") return String(data.promoter_id);
  if (typeof data.ref_id === "string") return data.ref_id;
  return null;
}

function extractUid(data: Record<string, unknown>): string | null {
  const referral = data.referral as Record<string, unknown> | undefined;
  if (referral && typeof referral.uid === "string") return referral.uid;
  if (typeof data.uid === "string") return data.uid;
  return null;
}

export async function handleFirstPromoterWebhook(
  supabase: SupabaseClient,
  payload: unknown,
): Promise<FirstPromoterWebhookResult> {
  if (!payload || typeof payload !== "object") {
    return { ok: false, error: "Invalid payload." };
  }

  const raw = payload as Record<string, unknown>;
  const eventId =
    (typeof raw.event_id === "string" && raw.event_id) ||
    (typeof raw.id === "string" && raw.id) ||
    null;
  if (!eventId) {
    return { ok: false, error: "Missing event_id." };
  }

  const { data: existing } = await supabase
    .from("partner_fp_webhook_events")
    .select("id")
    .eq("id", eventId)
    .maybeSingle();

  if (existing?.id) {
    return { ok: true, skipped: true, reason: "Duplicate event." };
  }

  await supabase.from("partner_fp_webhook_events").insert({ id: eventId });

  const config = await loadPlatformAttributionConfig(supabase);
  if (!config.firstpromoterEnabled) {
    return { ok: true, skipped: true, reason: "FirstPromoter disabled." };
  }

  const eventType =
    (typeof raw.event_type === "string" && raw.event_type) ||
    (typeof raw.type === "string" && raw.type) ||
    "";

  if (
    !eventType.includes("referral.created") &&
    !eventType.includes("referral.converted") &&
    eventType !== "lead_signup"
  ) {
    return { ok: true, skipped: true, reason: `Ignored event type ${eventType}` };
  }

  const data =
    (raw.data as Record<string, unknown> | undefined) ??
    (raw.referral as Record<string, unknown> | undefined) ??
    raw;

  const promoterId = extractPromoterId(data);
  const uid = extractUid(data);

  if (!promoterId) {
    return { ok: true, skipped: true, reason: "No promoter id in payload." };
  }

  const { data: mapping } = await supabase
    .from("partner_firstpromoter_mappings")
    .select("partner_profile_id, program")
    .eq("promoter_id", promoterId)
    .maybeSingle();

  if (!mapping?.partner_profile_id) {
    return {
      ok: true,
      skipped: true,
      reason: "Promoter not mapped to a Whitby partner.",
    };
  }

  if (!uid) {
    return {
      ok: true,
      skipped: true,
      reason: "No referred user uid — wait for Whitby identity capture.",
    };
  }

  // First-touch: only open attribution if user has no referral yet for program.
  const program =
    (mapping.program as string | null) === "academy"
      ? "academy"
      : (mapping.program as string | null) === "enterprise"
        ? null
        : "platform";

  if (!program) {
    return {
      ok: true,
      skipped: true,
      reason: "Enterprise mapping uses Opportunity flow, not referral webhook.",
    };
  }

  const { data: existingReferral } = await supabase
    .from("partner_referrals")
    .select("id")
    .eq("referred_user_id", uid)
    .eq("program", program === "platform" ? "platform" : program)
    .limit(1)
    .maybeSingle();

  // Also check whitbyos if platform
  if (!existingReferral && program === "platform") {
    const { data: whitby } = await supabase
      .from("partner_referrals")
      .select("id")
      .eq("referred_user_id", uid)
      .eq("program", "whitbyos")
      .limit(1)
      .maybeSingle();
    if (whitby?.id) {
      return {
        ok: true,
        skipped: true,
        reason: "First-touch already set (whitbyos).",
      };
    }
  }

  if (existingReferral?.id) {
    return {
      ok: true,
      skipped: true,
      reason: "First-touch already set — not overwriting.",
    };
  }

  // Persist Auth identity metadata hint for later ensure-program-referral.
  try {
    const { data: userData } = await supabase.auth.admin.getUserById(uid);
    if (userData?.user) {
      const meta = {
        ...(userData.user.user_metadata ?? {}),
        partner_referral_partner_id: mapping.partner_profile_id,
        partner_referral_source: "firstpromoter",
      };
      await supabase.auth.admin.updateUserById(uid, { user_metadata: meta });
    }
  } catch {
    // Auth update optional
  }

  return {
    ok: true,
    reason: "Mapped FirstPromoter referral; Whitby will open referral on product entry.",
  };
}
