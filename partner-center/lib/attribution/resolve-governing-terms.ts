import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Resolve governing agreement / program-terms document for an earning (§14.11).
 */
export async function resolveGoverningTerms(
  supabase: SupabaseClient,
  partnerProfileId: string,
): Promise<{ documentId: string | null; termsVersion: string | null }> {
  const { data: profile } = await supabase
    .from("partner_profiles")
    .select("agreement_document_id")
    .eq("id", partnerProfileId)
    .maybeSingle();

  const agreementId =
    (profile?.agreement_document_id as string | null) ?? null;

  const { data: metaRows } = await supabase
    .from("partner_document_meta")
    .select("document_id, document_kind")
    .eq("partner_profile_id", partnerProfileId)
    .in("document_kind", ["program_terms", "agreement"])
    .order("updated_at", { ascending: false })
    .limit(5);

  let documentId =
    (metaRows ?? []).find((row) => row.document_kind === "program_terms")
      ?.document_id as string | undefined;
  if (!documentId) {
    documentId =
      ((metaRows ?? []).find((row) => row.document_kind === "agreement")
        ?.document_id as string | undefined) ??
      agreementId ??
      undefined;
  }

  if (!documentId) {
    return { documentId: null, termsVersion: null };
  }

  const { data: doc } = await supabase
    .from("documents")
    .select("id, version, title")
    .eq("id", documentId)
    .maybeSingle();

  const versionRaw = doc?.version;
  const titleRaw = doc?.title;
  const version =
    (typeof versionRaw === "string" ? versionRaw.trim() : "") ||
    (typeof versionRaw === "number" ? String(versionRaw) : "") ||
    (typeof titleRaw === "string" ? titleRaw.trim() : "") ||
    null;

  return { documentId, termsVersion: version };
}
