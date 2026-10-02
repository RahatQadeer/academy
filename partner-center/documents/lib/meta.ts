/** Partner document meta helpers — structured fields on partner_document_meta. */

export type PartnerDocumentKind =
  | "agreement"
  | "program_terms"
  | "guideline"
  | "marketing"
  | "tax"
  | "other";

export type PartnerDocumentProgram = "academy" | "platform" | "enterprise";

export type PartnerDocumentMetaRow = {
  document_id: string;
  partner_profile_id: string;
  program: PartnerDocumentProgram | null;
  expiration_date: string | null;
  external_signature_ref: string | null;
  document_kind: PartnerDocumentKind;
  needed_action: "review" | "sign_externally" | "upload" | "update" | null;
};

export function parseDocumentKind(value: unknown): PartnerDocumentKind {
  if (
    value === "agreement" ||
    value === "program_terms" ||
    value === "guideline" ||
    value === "marketing" ||
    value === "tax" ||
    value === "other"
  ) {
    return value;
  }
  return "other";
}

export function parseDocumentProgram(
  value: unknown,
): PartnerDocumentProgram | null {
  if (value === "academy" || value === "platform" || value === "enterprise") {
    return value;
  }
  return null;
}

export function parseNeededActionMeta(
  value: unknown,
): PartnerDocumentMetaRow["needed_action"] {
  if (
    value === "review" ||
    value === "sign_externally" ||
    value === "upload" ||
    value === "update"
  ) {
    return value;
  }
  return null;
}

export function programLabelFromMeta(
  program: PartnerDocumentProgram | null | undefined,
): string {
  if (program === "academy") return "Academy";
  if (program === "platform") return "Whitby";
  if (program === "enterprise") return "Enterprise";
  return "—";
}

/** List/detail label: agreements with no program are org-wide → "All". */
export function programLabelForDocument(input: {
  program: PartnerDocumentProgram | null | undefined;
  documentKind: PartnerDocumentKind | null | undefined;
}): string {
  if (input.documentKind === "agreement" && !input.program) return "All";
  return programLabelFromMeta(input.program ?? null);
}

export function typeLabelFromKind(kind: PartnerDocumentKind): string {
  if (kind === "agreement") return "Partner Agreement";
  if (kind === "program_terms") return "Program Terms";
  if (kind === "guideline") return "Guideline";
  if (kind === "marketing") return "Marketing";
  if (kind === "tax") return "Tax form";
  return "Document";
}
