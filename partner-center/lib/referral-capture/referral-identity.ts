import type { SupabaseClient } from "@supabase/supabase-js";
import {
  PARTNER_REF_AT_META,
  PARTNER_REF_CODE_META,
} from "@/partner-center/lib/referral-capture/constants";

export type StoredReferralIdentity = {
  code: string;
  capturedAt?: string;
};

export async function persistReferralIdentity(
  supabase: SupabaseClient,
  userId: string,
  code: string,
  capturedAt?: string,
): Promise<void> {
  const trimmed = code.trim();
  if (!trimmed) return;

  await supabase.auth.admin.updateUserById(userId, {
    user_metadata: {
      [PARTNER_REF_CODE_META]: trimmed,
      [PARTNER_REF_AT_META]: capturedAt ?? new Date().toISOString(),
    },
  });
}

export async function readReferralIdentityFromUser(
  supabase: SupabaseClient,
  userId: string,
): Promise<StoredReferralIdentity | null> {
  const { data, error } = await supabase.auth.admin.getUserById(userId);
  if (error || !data.user) return null;

  const meta = data.user.user_metadata ?? {};
  const code =
    typeof meta[PARTNER_REF_CODE_META] === "string"
      ? meta[PARTNER_REF_CODE_META].trim()
      : "";
  if (!code) return null;

  const capturedAt =
    typeof meta[PARTNER_REF_AT_META] === "string"
      ? meta[PARTNER_REF_AT_META]
      : undefined;

  return { code, capturedAt };
}

export async function resolveUserEmail(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ email: string; fullName?: string } | null> {
  const { data, error } = await supabase.auth.admin.getUserById(userId);
  if (error || !data.user?.email) return null;
  const fullName =
    typeof data.user.user_metadata?.full_name === "string"
      ? data.user.user_metadata.full_name
      : undefined;
  return { email: data.user.email, fullName };
}
