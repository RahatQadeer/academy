import { createClient, isSupabaseConfigured } from "@/base/lib/supabase/server";
import {
  formatDocumentDate,
  previewKindFromUrl,
  resolveNeededAction,
  typeLabelFromDocumentKind,
} from "@/partner-center/documents/lib/format";
import { ensurePartnerDocumentMetaRows } from "@/partner-center/documents/lib/meta-store";
import type {
  DocumentDetailData,
  DocumentStatus,
} from "@/partner-center/documents/types";
import { createAdminClient } from "@/partner-center/lib/supabase-admin";
import type { PartnerContext } from "@/partner-center/types/partner";

function canMutate(context: PartnerContext | null): boolean {
  return context?.teamMember?.access_level !== "read_only";
}

export type DocumentDetailLoadResult =
  | { kind: "ok"; data: DocumentDetailData }
  | { kind: "not_found" }
  | { kind: "denied" };

export async function loadDocumentDetail(
  context: PartnerContext | null,
  documentId: string,
  userId: string,
): Promise<DocumentDetailLoadResult> {
  const profile = context?.profile;
  if (!profile || !isSupabaseConfigured()) return { kind: "not_found" };

  const supabase = await createClient();
  const reader = createAdminClient() ?? supabase;

  const { data: row } = await reader
    .from("documents")
    .select(
      "id, title, status, visibility, version, effective_date, signed_date, file_url, uploaded_by_user_id, shared_by_user_id, superseded_by_document_id, created_at",
    )
    .eq("id", documentId)
    .eq("context_type", "partner_profile")
    .eq("context_id", profile.id)
    .maybeSingle();

  if (!row) return { kind: "not_found" };
  if ((row.visibility as string) === "restricted") return { kind: "denied" };

  const { data: oppLink } = await reader
    .from("partner_opportunities")
    .select("id")
    .eq("partner_profile_id", profile.id)
    .eq("attachment_document_id", documentId)
    .maybeSingle();
  if (oppLink) return { kind: "not_found" };

  const { data: labelRows } = await reader
    .from("document_labels")
    .select("label_text")
    .eq("document_id", documentId);

  const labels = (labelRows ?? [])
    .map((item) => (item.label_text as string)?.trim())
    .filter((text): text is string => Boolean(text));

  const metaByDoc = await ensurePartnerDocumentMetaRows(reader, profile.id, [
    documentId,
  ]);
  const meta = metaByDoc.get(documentId);
  const documentKind = meta?.document_kind ?? "other";

  const supersederId = row.id as string;
  const { data: superseded } = await reader
    .from("documents")
    .select("title")
    .eq("superseded_by_document_id", supersederId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  const sharedById = (row.shared_by_user_id as string | null) ?? null;
  const uploadedById = (row.uploaded_by_user_id as string | null) ?? null;
  const nameIds = [sharedById, uploadedById].filter(
    (id): id is string => Boolean(id),
  );
  const names = new Map<string, string>();
  if (nameIds.length > 0) {
    const { data: users } = await reader
      .from("users")
      .select("id, full_name, preferred_name, email")
      .in("id", [...new Set(nameIds)]);
    for (const user of users ?? []) {
      names.set(
        user.id as string,
        (user.preferred_name as string) ||
          (user.full_name as string) ||
          (user.email as string) ||
          "Someone",
      );
    }
  }

  let sharedByLabel = "Private Attaché";
  if (sharedById && names.get(sharedById)) {
    sharedByLabel = names.get(sharedById)!;
  } else if (uploadedById && uploadedById !== userId) {
    sharedByLabel = names.get(uploadedById) || "Private Attaché";
  } else if (uploadedById === userId) {
    sharedByLabel = "You";
  }
  // else: Super Admin cookie staff have no users row, so shared/uploaded IDs
  // are null — still attribute the share to Private Attaché.

  const status = (row.status as DocumentStatus) ?? "current";
  const title = (row.title as string) || "Untitled";
  const fileUrl = (row.file_url as string) || "";
  const neededAction = resolveNeededAction({
    status,
    neededAction: meta?.needed_action ?? null,
    fileUrl,
  });

  const showGovernsTerms =
    profile.agreement_document_id === documentId ||
    documentKind === "agreement";

  const signatureRef = meta?.external_signature_ref?.trim() || "";

  return {
    kind: "ok",
    data: {
    id: documentId,
    title,
    status,
    labels,
    version: (row.version as number) ?? 1,
    effectiveDateLabel: formatDocumentDate(
      (row.effective_date as string | null) ?? null,
    ),
    signedDateLabel: formatDocumentDate(
      (row.signed_date as string | null) ?? null,
    ),
    expirationDateLabel: formatDocumentDate(meta?.expiration_date ?? null),
    externalSignatureRef: signatureRef || "—",
    typeLabel: typeLabelFromDocumentKind(documentKind, title),
    documentKind,
    supersedesTitle: (superseded?.title as string | null) ?? null,
    supersededByDocumentId:
      (row.superseded_by_document_id as string | null) ?? null,
    sharedByLabel,
    fileUrl,
    previewKind: previewKindFromUrl(fileUrl),
    canMutate: canMutate(context),
    isOwnUpload: uploadedById === userId,
    showGovernsTerms,
    neededAction,
    companyName: context.company?.name?.trim() || "your company",
    },
  };
}
