import "server-only";

import { createAdminClient, isSupabaseAdminConfigured } from "@/base/lib/supabase/admin";
import { normalizeEmail } from "@/base/lib/email";

export type ActiveAccountRow = {
  id: string;
  email: string;
  status: "active" | "suspended" | "deleted";
};

export async function findActiveAccountsByEmail(email: string): Promise<ActiveAccountRow[]> {
  const normalized = normalizeEmail(email);
  if (!normalized || !isSupabaseAdminConfigured()) return [];

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("find_active_accounts_by_normalized_email", {
    p_email: normalized,
  });

  if (error || !data) {
    const { data: fallback } = await admin
      .from("users")
      .select("id, email, status")
      .eq("email", normalized)
      .neq("status", "deleted")
      .limit(8);
    return (fallback ?? []) as ActiveAccountRow[];
  }

  return data as ActiveAccountRow[];
}

export async function emailHasActiveAccount(email: string): Promise<boolean> {
  const accounts = await findActiveAccountsByEmail(email);
  return accounts.length > 0;
}
