import type { SupabaseClient } from "@supabase/supabase-js";
import {
  parseDocumentKind,
  parseDocumentProgram,
  parseNeededActionMeta,
  type PartnerDocumentKind,
  type PartnerDocumentProgram,
  type PartnerDocumentMetaRow,
} from "@/partner-center/documents/lib/meta";

type Db = SupabaseClient;

export type UpsertPartnerDocumentMetaInput = {
  documentId: string;
  partnerProfileId: string;
  program?: PartnerDocumentProgram | null;
  expirationDate?: string | null;
  externalSignatureRef?: string | null;
  documentKind?: PartnerDocumentKind;
  neededAction?: PartnerDocumentMetaRow["needed_action"];
};

export async function upsertPartnerDocumentMeta(
  writer: Db,
  input: UpsertPartnerDocumentMetaInput,
): Promise<void> {
  await writer.from("partner_document_meta").upsert(
    {
      document_id: input.documentId,
      partner_profile_id: input.partnerProfileId,
      program: input.program ?? null,
      expiration_date: input.expirationDate ?? null,
      external_signature_ref: input.externalSignatureRef ?? null,
      document_kind: input.documentKind ?? "other",
      needed_action: input.neededAction ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "document_id" },
  );
}

/** Ensure every listed document has a meta row (default kind=other). */
export async function ensurePartnerDocumentMetaRows(
  writer: Db,
  partnerProfileId: string,
  documentIds: string[],
): Promise<Map<string, PartnerDocumentMetaRow>> {
  const byId = new Map<string, PartnerDocumentMetaRow>();
  if (documentIds.length === 0) return byId;

  const { data: existing } = await writer
    .from("partner_document_meta")
    .select(
      "document_id, partner_profile_id, program, expiration_date, external_signature_ref, document_kind, needed_action",
    )
    .in("document_id", documentIds);

  for (const row of existing ?? []) {
    const id = row.document_id as string;
    byId.set(id, {
      document_id: id,
      partner_profile_id: row.partner_profile_id as string,
      program: parseDocumentProgram(row.program),
      expiration_date: (row.expiration_date as string | null) ?? null,
      external_signature_ref:
        (row.external_signature_ref as string | null) ?? null,
      document_kind: parseDocumentKind(row.document_kind),
      needed_action: parseNeededActionMeta(row.needed_action),
    });
  }

  const missing = documentIds.filter((id) => !byId.has(id));
  if (missing.length > 0) {
    const rows = missing.map((document_id) => ({
      document_id,
      partner_profile_id: partnerProfileId,
      program: null,
      expiration_date: null,
      external_signature_ref: null,
      document_kind: "other" as const,
      needed_action: null,
    }));
    await writer.from("partner_document_meta").upsert(rows, {
      onConflict: "document_id",
      ignoreDuplicates: true,
    });
    for (const row of rows) {
      byId.set(row.document_id, {
        document_id: row.document_id,
        partner_profile_id: partnerProfileId,
        program: null,
        expiration_date: null,
        external_signature_ref: null,
        document_kind: "other",
        needed_action: null,
      });
    }
  }

  return byId;
}

export async function copyPartnerDocumentMeta(input: {
  writer: Db;
  fromDocumentId: string;
  toDocumentId: string;
  partnerProfileId: string;
  overrides?: Partial<UpsertPartnerDocumentMetaInput>;
}): Promise<void> {
  const { data: prior } = await input.writer
    .from("partner_document_meta")
    .select(
      "program, expiration_date, external_signature_ref, document_kind, needed_action",
    )
    .eq("document_id", input.fromDocumentId)
    .maybeSingle();

  await upsertPartnerDocumentMeta(input.writer, {
    documentId: input.toDocumentId,
    partnerProfileId: input.partnerProfileId,
    program: parseDocumentProgram(prior?.program) ?? null,
    expirationDate: (prior?.expiration_date as string | null) ?? null,
    externalSignatureRef:
      (prior?.external_signature_ref as string | null) ?? null,
    documentKind: parseDocumentKind(prior?.document_kind),
    neededAction: parseNeededActionMeta(prior?.needed_action),
    ...input.overrides,
  });
}
