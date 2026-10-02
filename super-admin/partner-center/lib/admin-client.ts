import { createAdminClient } from "@/partner-center/lib/supabase-admin";

export { createAdminClient };

export function isAdminDataConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() &&
      process.env.SUPABASE_SERVICE_ROLE_KEY?.trim(),
  );
}
