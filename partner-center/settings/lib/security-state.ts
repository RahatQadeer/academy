import { createClient, isSupabaseConfigured } from "@/base/lib/supabase/server";

export type PartnerMfaState = {
  enabled: boolean;
  factorId: string | null;
  pendingFactorId: string | null;
  method: string | null;
};

export async function loadPartnerMfaState(): Promise<PartnerMfaState> {
  if (!isSupabaseConfigured()) {
    return {
      enabled: false,
      factorId: null,
      pendingFactorId: null,
      method: null,
    };
  }

  const supabase = await createClient();
  const { data: factors } = await supabase.auth.mfa.listFactors();
  const all = factors?.all ?? [];
  const verified = all.find((factor) => factor.status === "verified");
  const pending = all.find((factor) => factor.status === "unverified");

  return {
    enabled: Boolean(verified),
    factorId: verified?.id ?? null,
    pendingFactorId: pending?.id ?? null,
    method: verified ? "Authenticator app" : null,
  };
}
