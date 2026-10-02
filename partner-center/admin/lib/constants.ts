import "server-only";

import { createHash, randomBytes } from "crypto";
import { createClient } from "@supabase/supabase-js";
import {
  PARTNER_ADMIN_INVITE_TTL_MS,
} from "@/partner-center/admin/lib/shared";

export * from "@/partner-center/admin/lib/shared";

export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export function hashInviteToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function mintInviteToken() {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: hashInviteToken(token) };
}

export function inviteExpiresAt(from = new Date()) {
  return new Date(from.getTime() + PARTNER_ADMIN_INVITE_TTL_MS).toISOString();
}
