import "server-only";

import { createServiceClient } from "@/base/lib/supabase/service";
import { createClient, isSupabaseConfigured } from "@/base/lib/supabase/server";
import type { AcademyCredentialType } from "@/academy/lib/domain";
import { credentialTypeLabel } from "../utils/labels";
import {
  formatCredentialPublicId,
  parseCredentialPublicId,
} from "../utils/publicId";

export type VerifiedCredential = {
  /** Canonical 7-digit certificate number. */
  publicId: string;
  /** Visual print form, e.g. PA-SE-1234567. */
  displayId: string;
  type: AcademyCredentialType;
  typeLabel: string;
  learnerName: string;
  programName: string;
  awardedAt: string;
  expiresAt: string | null;
  expired: boolean;
};

export type VerifyCredentialResult =
  | { ok: true; data: VerifiedCredential }
  | { ok: false; reason: "invalid_id" | "not_found" | "unavailable" };

type CredentialRow = {
  id: string;
  type: string;
  awarded_at: string | null;
  expires_at: string | null;
  user_id: string;
  program_id: string;
  certificate_number: string | null;
};

function learnerDisplayName(row: {
  full_name: string | null;
  preferred_name: string | null;
  email: string | null;
}) {
  return (row.full_name || row.preferred_name || row.email || "Learner").trim();
}

/**
 * Public certificate check. Prefers the service role so unauthenticated
 * visitors can verify; falls back to the session client when the service key
 * is absent (local preview / misconfigured deploy).
 *
 * Lookup is by the 7-digit certificate_number only. Prefixes (PA-SE / PA-CC / …)
 * are decorative and ignored for matching.
 */
export async function verifyCredentialByPublicId(
  rawCode: string,
): Promise<VerifyCredentialResult> {
  const parsed = parseCredentialPublicId(rawCode);
  if (!parsed) return { ok: false, reason: "invalid_id" };

  if (!isSupabaseConfigured()) return { ok: false, reason: "unavailable" };

  const service = createServiceClient();
  const supabase = service ?? (await createClient());

  const { data, error } = await supabase
    .from("academy_credentials")
    .select("id, type, awarded_at, expires_at, user_id, program_id, certificate_number")
    .eq("status", "awarded")
    .eq("certificate_number", parsed.number)
    .maybeSingle();

  if (error) return { ok: false, reason: "unavailable" };

  const row = data as CredentialRow | null;
  if (!row || !row.awarded_at || !row.certificate_number) {
    return { ok: false, reason: "not_found" };
  }

  const [{ data: user }, { data: program }] = await Promise.all([
    supabase
      .from("users")
      .select("full_name, preferred_name, email")
      .eq("id", row.user_id)
      .maybeSingle(),
    supabase
      .from("academy_programs")
      .select("name")
      .eq("id", row.program_id)
      .maybeSingle(),
  ]);

  const expiresAt = row.expires_at;
  const expired = Boolean(expiresAt && Date.parse(expiresAt) < Date.now());
  const type = row.type as AcademyCredentialType;

  return {
    ok: true,
    data: {
      publicId: row.certificate_number,
      displayId: formatCredentialPublicId(type, row.certificate_number),
      type,
      typeLabel: credentialTypeLabel(type),
      learnerName: user
        ? learnerDisplayName(
            user as {
              full_name: string | null;
              preferred_name: string | null;
              email: string | null;
            },
          )
        : "Learner",
      programName:
        (program as { name: string | null } | null)?.name?.trim() || "Academy program",
      awardedAt: row.awarded_at,
      expiresAt,
      expired,
    },
  };
}
