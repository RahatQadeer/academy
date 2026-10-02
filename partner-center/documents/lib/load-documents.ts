import { createClient, isSupabaseConfigured } from "@/base/lib/supabase/server";
import {
  actionHrefFor,
  actionLabelFor,
  formatDocumentDate,
  programDisplayLabel,
  resolveNeededAction,
} from "@/partner-center/documents/lib/format";
import { ensurePartnerDocumentMetaRows } from "@/partner-center/documents/lib/meta-store";
import type {
  DocumentListFilters,
  DocumentListItem,
  DocumentStatus,
  DocumentsPageData,
} from "@/partner-center/documents/types";
import { createAdminClient } from "@/partner-center/lib/supabase-admin";
import type { LoadResult } from "@/partner-center/lib/load-result";
import { isAgreementSigned } from "@/partner-center/lib/review-state";
import type { PartnerContext } from "@/partner-center/types/partner";
import type { User } from "@/base/types";

function canMutate(context: PartnerContext | null): boolean {
  const access = context?.teamMember?.access_level;
  return access !== "read_only";
}

/** Acceptance / creation date for terms shown on the virtual Program Terms row. */
function agreementAcceptedAt(
  profile: PartnerContext["profile"],
  agreementRow?: {
    signed_date?: string | null;
    effective_date?: string | null;
    created_at?: string | null;
  } | null,
): string | null {
  if (!profile) return null;
  const data = profile.application_data;
  if (data && typeof data === "object" && !Array.isArray(data)) {
    const signed = (data as { agreement_signed_at?: unknown }).agreement_signed_at;
    if (typeof signed === "string" && signed.trim()) return signed.trim();
  }
  const fromDoc =
    agreementRow?.signed_date ||
    agreementRow?.effective_date ||
    agreementRow?.created_at ||
    null;
  if (fromDoc) return fromDoc;
  if (isAgreementSigned(profile.agreement_status)) {
    return profile.created_at ?? null;
  }
  return null;
}

export async function loadDocumentsPage(
  context: PartnerContext | null,
  filters: DocumentListFilters,
  _user?: User | null,
): Promise<LoadResult<DocumentsPageData>> {
  const profile = context?.profile;
  if (!profile) {
    return { ok: false, error: "Documents could not be loaded." };
  }

  const companyName =
    context.company?.name?.trim() || "your company";
  const mutate = canMutate(context);

  if (!isSupabaseConfigured()) {
    return {
      ok: true,
      data: {
        companyName,
        canMutate: mutate,
        items: [],
        hasRealProgramTerms: false,
        programTermsAcceptedAt: agreementAcceptedAt(profile),
        actionNeededCount: 0,
        labelGroups: [],
        allLabels: [],
        filters,
        agreementDocumentId: profile.agreement_document_id,
      },
    };
  }

  const supabase = await createClient();
  const reader = createAdminClient() ?? supabase;

  const [{ data: docs, error: docsError }, { data: oppRows, error: oppError }] =
    await Promise.all([
    reader
      .from("documents")
      .select(
        "id, title, status, visibility, version, effective_date, signed_date, file_url, uploaded_by_user_id, shared_by_user_id, created_at, updated_at",
      )
      .eq("context_type", "partner_profile")
      .eq("context_id", profile.id)
      .neq("visibility", "restricted")
      .order("updated_at", { ascending: false }),
    reader
      .from("partner_opportunities")
      .select("attachment_document_id")
      .eq("partner_profile_id", profile.id)
      .not("attachment_document_id", "is", null),
    ]);

  if (docsError || oppError) {
    return { ok: false, error: "Documents could not be loaded." };
  }

  const attachmentIds = new Set(
    (oppRows ?? [])
      .map((row) => row.attachment_document_id as string | null)
      .filter((id): id is string => Boolean(id)),
  );

  const visibleDocs = (docs ?? []).filter((row) => {
    const id = row.id as string;
    if (attachmentIds.has(id)) return false;
    return true;
  });

  const docIds = visibleDocs.map((row) => row.id as string);
  const labelByDoc = new Map<string, string[]>();
  if (docIds.length > 0) {
    const { data: labelRows } = await reader
      .from("document_labels")
      .select("document_id, label_text")
      .in("document_id", docIds);
    for (const row of labelRows ?? []) {
      const id = row.document_id as string;
      const text = (row.label_text as string)?.trim();
      if (!text) continue;
      const list = labelByDoc.get(id) ?? [];
      list.push(text);
      labelByDoc.set(id, list);
    }
  }

  const metaByDoc = await ensurePartnerDocumentMetaRows(
    reader,
    profile.id,
    docIds,
  );

  const items: DocumentListItem[] = visibleDocs.map((row) => {
    const id = row.id as string;
    const status = (row.status as DocumentStatus) ?? "current";
    const labels = labelByDoc.get(id) ?? [];
    const meta = metaByDoc.get(id);
    const documentKind = meta?.document_kind ?? "other";
    const dateIso =
      (row.signed_date as string | null) ??
      (row.effective_date as string | null) ??
      (row.created_at as string | null);
    const neededAction = resolveNeededAction({
      status,
      neededAction: meta?.needed_action ?? null,
      fileUrl: (row.file_url as string | null) ?? null,
    });
    return {
      kind: "document",
      id,
      title: (row.title as string) || "Untitled",
      status,
      labels,
      programLabel: programDisplayLabel(meta?.program ?? null, documentKind),
      documentKind,
      dateIso,
      dateLabel: formatDocumentDate(dateIso),
      neededAction,
      actionLabel: actionLabelFor(neededAction, status),
      actionHref: actionHrefFor(id, neededAction, documentKind),
      uploadedByUserId: (row.uploaded_by_user_id as string | null) ?? null,
    };
  });

  const actionNeededCount = items.filter(
    (item) => item.status === "action_needed",
  ).length;

  const hasRealProgramTerms = items.some(
    (item) => item.documentKind === "program_terms",
  );

  const agreementRow =
    (visibleDocs.find((row) => row.id === profile.agreement_document_id) as
      | {
          signed_date?: string | null;
          effective_date?: string | null;
          created_at?: string | null;
        }
      | undefined) ?? null;
  const programTermsAcceptedAt = agreementAcceptedAt(profile, agreementRow);

  const labelCounts = new Map<string, number>();
  for (const item of items) {
    for (const label of item.labels) {
      labelCounts.set(label, (labelCounts.get(label) ?? 0) + 1);
    }
  }
  const allLabels = [...labelCounts.keys()].sort((a, b) =>
    a.localeCompare(b),
  );
  const labelGroups = allLabels.map((label) => ({
    label,
    count: labelCounts.get(label) ?? 0,
  }));

  return {
    ok: true,
    data: {
      companyName,
      canMutate: mutate,
      items,
      hasRealProgramTerms,
      programTermsAcceptedAt,
      actionNeededCount,
      labelGroups,
      allLabels,
      filters,
      agreementDocumentId: profile.agreement_document_id,
    },
  };
}
