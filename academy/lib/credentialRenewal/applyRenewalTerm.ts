import "server-only";

import { expiryFromAward } from "@/academy/admin/credentials/lib/format";
import { isCredentialRenewalOpen } from "@/academy/lib/credentialRenewal/eligibility";

type SupabaseLike = {
  from: (table: string) => {
    update: (values: Record<string, unknown>) => {
      eq: (column: string, value: string) => PromiseLike<{ error: { message: string } | null }>;
    };
    delete: () => {
      eq: (column: string, value: string) => PromiseLike<{ error: { message: string } | null }>;
    };
  };
};

/**
 * Extend a timed credential by 3 years from the later of now or current expires_at.
 * Only allowed on/after the expiration calendar day — blocks early year-stacking.
 * Clears renewal-reminder ledger so 90/60/30 windows can fire for the new term.
 * Keeps the same certificate_number / public ID.
 */
export async function applyCredentialRenewalTerm(input: {
  supabase: SupabaseLike;
  credentialId: string;
  currentExpiresAt: string;
}): Promise<{ ok: true; expiresAt: string } | { ok: false; message: string }> {
  if (!isCredentialRenewalOpen(input.currentExpiresAt)) {
    return {
      ok: false,
      message:
        "Renewal is only available on or after the certificate expiration date. Early renewal is not allowed.",
    };
  }

  const currentExpiry = new Date(input.currentExpiresAt);
  const base = Number.isNaN(currentExpiry.getTime())
    ? new Date()
    : currentExpiry.getTime() > Date.now()
      ? currentExpiry
      : new Date();
  const nextExpires = expiryFromAward(base, 3);

  const { error: updateError } = await input.supabase
    .from("academy_credentials")
    .update({
      expires_at: nextExpires,
      renewal_status: "active",
    })
    .eq("id", input.credentialId);

  if (updateError) {
    return { ok: false, message: "The certificate term could not be extended." };
  }

  await input.supabase
    .from("academy_credential_renewal_reminders")
    .delete()
    .eq("credential_id", input.credentialId);

  return { ok: true, expiresAt: nextExpires };
}
