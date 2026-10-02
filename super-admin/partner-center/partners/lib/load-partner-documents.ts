import "server-only";

import {
  actionHrefFor,
  documentStatusLabel,
  formatDocumentDate,
  programDisplayLabel,
  resolveNeededAction,
  typeLabelFromDocumentKind,
} from "@/partner-center/documents/lib/format";
import {
  parseDocumentKind,
  parseDocumentProgram,
  parseNeededActionMeta,
  type PartnerDocumentKind,
  type PartnerDocumentProgram,
} from "@/partner-center/documents/lib/meta";
import { ensurePartnerDocumentMetaRows } from "@/partner-center/documents/lib/meta-store";
import type {
  DocumentNeededAction,
  DocumentStatus,
} from "@/partner-center/documents/types";
import {
  createAdminClient,
  isAdminDataConfigured,
} from "@/super-admin/partner-center/lib/admin-client";
import { requireSuperAdmin } from "@/super-admin/lib/is-super-admin";

export type AdminPartnerDocumentRow = {
  id: string;
  title: string;
  status: DocumentStatus;
  version: number;
  effectiveDate: string | null;
  signedDate: string | null;
  fileUrl: string | null;
  supersededByDocumentId: string | null;
  documentKind: PartnerDocumentKind;
  program: PartnerDocumentProgram | null;
  programLabel: string;
  expirationDate: string | null;
  externalSignatureRef: string | null;
  neededAction: DocumentNeededAction;
  dateLabel: string;
  typeLabel: string;
  statusLabel: string;
  partnerHref: string;
  updatedAt: string | null;
};

export type AdminPartnerDocumentsPage = {
  partnerProfileId: string;
  companyName: string;
  agreementDocumentId: string | null;
  agreementStatus: string | null;
  items: AdminPartnerDocumentRow[];
  /** Other library docs for supersedes picker (id + title). */
  supersedeOptions: { id: string; title: string }[];
  /** All titles including archived — for successor links. */
  allTitles: { id: string; title: string }[];
};

export async function loadAdminPartnerDocuments(
  partnerProfileId: string,
): Promise<{
  data: AdminPartnerDocumentsPage | null;
  configured: boolean;
  error?: string;
}> {
  await requireSuperAdmin();
  if (!isAdminDataConfigured()) {
    return { data: null, configured: false };
  }

  const admin = createAdminClient();
  if (!admin) return { data: null, configured: false };

  const { data: profile, error: profileError } = await admin
    .from("partner_profiles")
    .select("id, company_id, agreement_status, agreement_document_id")
    .eq("id", partnerProfileId)
    .maybeSingle();

  if (profileError) {
    return { data: null, configured: true, error: profileError.message };
  }
  if (!profile) return { data: null, configured: true };

  let companyName = "Partner";
  if (profile.company_id) {
    const { data: company } = await admin
      .from("companies")
      .select("name")
      .eq("id", profile.company_id as string)
      .maybeSingle();
    if (company?.name) companyName = company.name as string;
  }

  const [{ data: docs, error: docsError }, { data: oppRows }] = await Promise.all([
    admin
      .from("documents")
      .select(
        "id, title, status, visibility, version, effective_date, signed_date, file_url, superseded_by_document_id, created_at, updated_at",
      )
      .eq("context_type", "partner_profile")
      .eq("context_id", partnerProfileId)
      .neq("visibility", "restricted")
      .order("updated_at", { ascending: false }),
    admin
      .from("partner_opportunities")
      .select("attachment_document_id")
      .eq("partner_profile_id", partnerProfileId)
      .not("attachment_document_id", "is", null),
  ]);

  if (docsError) {
    return { data: null, configured: true, error: docsError.message };
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
  const metaByDoc = await ensurePartnerDocumentMetaRows(
    admin,
    partnerProfileId,
    docIds,
  );

  const items: AdminPartnerDocumentRow[] = visibleDocs.map((row) => {
    const id = row.id as string;
    const status = (row.status as DocumentStatus) ?? "current";
    const meta = metaByDoc.get(id);
    const documentKind = meta?.document_kind ?? parseDocumentKind(null);
    const neededAction = resolveNeededAction({
      status,
      neededAction: meta?.needed_action ?? null,
      fileUrl: (row.file_url as string | null) ?? null,
    });
    const dateIso =
      (row.effective_date as string | null) ??
      (row.created_at as string | null);
    const title = (row.title as string) || "Untitled";
    return {
      id,
      title,
      status,
      version: (row.version as number) ?? 1,
      effectiveDate: (row.effective_date as string | null) ?? null,
      signedDate: (row.signed_date as string | null) ?? null,
      fileUrl: (row.file_url as string | null) ?? null,
      supersededByDocumentId:
        (row.superseded_by_document_id as string | null) ?? null,
      documentKind,
      program: meta?.program ?? null,
      programLabel: programDisplayLabel(meta?.program ?? null),
      expirationDate: meta?.expiration_date ?? null,
      externalSignatureRef: meta?.external_signature_ref ?? null,
      neededAction,
      dateLabel: formatDocumentDate(dateIso),
      typeLabel: typeLabelFromDocumentKind(documentKind, title),
      statusLabel: documentStatusLabel(status),
      partnerHref: actionHrefFor(id, neededAction, documentKind),
      updatedAt: (row.updated_at as string | null) ?? null,
    };
  });

  const supersedeOptions = items
    .filter((item) => item.status !== "archived")
    .map((item) => ({ id: item.id, title: item.title }));

  const allTitles = items.map((item) => ({ id: item.id, title: item.title }));

  return {
    data: {
      partnerProfileId,
      companyName,
      agreementDocumentId:
        (profile.agreement_document_id as string | null) ?? null,
      agreementStatus: (profile.agreement_status as string | null) ?? null,
      items,
      supersedeOptions,
      allTitles,
    },
    configured: true,
  };
}

export function parseAdminDocumentStatus(value: unknown): DocumentStatus | null {
  if (
    value === "current" ||
    value === "action_needed" ||
    value === "completed" ||
    value === "archived"
  ) {
    return value;
  }
  return null;
}

export {
  parseDocumentKind,
  parseDocumentProgram,
  parseNeededActionMeta,
};
