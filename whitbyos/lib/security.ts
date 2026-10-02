import { createClient } from "@/base/lib/supabase/server";
import { getCurrentWorkspaceId } from "@/whitbyos/lib/workspace";

export type SecurityState = {
  enabled: boolean;
  factorId: string | null;
  /** An enrolment that has been started and never confirmed with a code. */
  pendingFactorId: string | null;
  method: string | null;
  singleSession: boolean;
};

/**
 * Screen 17.6.
 *
 * Whether 2FA is on is Supabase's answer, not ours — the factor lives with the
 * auth service, which is the whole reason to use theirs. A second factor whose
 * secret sat in a table the app can read is not a second factor.
 */
export async function getSecurityState(): Promise<SecurityState> {
  const supabase = await createClient();
  const workspaceId = await getCurrentWorkspaceId();

  const { data: factors } = await supabase.auth.mfa.listFactors();
  const verified = (factors?.all ?? []).find((factor) => factor.status === "verified");
  const pending = (factors?.all ?? []).find((factor) => factor.status === "unverified");

  let singleSession = false;
  if (workspaceId) {
    const { data } = await supabase
      .from("whitbyos_workspace_settings")
      .select("single_session")
      .eq("workspace_id", workspaceId)
      .maybeSingle();

    singleSession = Boolean(data?.single_session);
  }

  return {
    enabled: Boolean(verified),
    factorId: verified?.id ?? null,
    pendingFactorId: pending?.id ?? null,
    method: verified ? "Authenticator app (TOTP)" : null,
    singleSession,
  };
}
