export type DocumentStatus =
  | "current"
  | "action_needed"
  | "completed"
  | "archived";

export type DocumentsTab = "all" | "action-needed" | "labels" | "archived";

export type DocumentDateRange = "all" | "30" | "90";

/** Program filter values from partner_document_meta.program (§17.11.2). */
export type DocumentProgramFilter =
  | "all"
  | "academy"
  | "platform"
  | "enterprise";

export type DocumentStatusFilter = DocumentStatus | "all";

export type DocumentListFilters = {
  tab: DocumentsTab;
  status: DocumentStatusFilter;
  program: DocumentProgramFilter;
  label: string;
  range: DocumentDateRange;
  q: string;
};

export type DocumentNeededAction =
  | "review"
  | "sign_externally"
  | "upload"
  | "update"
  | null;

export type PartnerDocumentKind =
  | "agreement"
  | "program_terms"
  | "guideline"
  | "marketing"
  | "tax"
  | "other";

export type DocumentListItem = {
  kind: "document";
  id: string;
  title: string;
  status: DocumentStatus;
  labels: string[];
  /** From partner_document_meta.program; "—" when null. */
  programLabel: string;
  documentKind: PartnerDocumentKind;
  dateIso: string | null;
  dateLabel: string;
  neededAction: DocumentNeededAction;
  actionLabel: string;
  actionHref: string;
  uploadedByUserId: string | null;
};

/** Temporary library entry until a real program_terms document exists. */
export type ProgramTermsListItem = {
  kind: "program_terms";
  id: "terms";
  title: string;
  status: "current";
  labels: string[];
  programLabel: string;
  documentKind: "program_terms";
  dateIso: string | null;
  dateLabel: string;
  neededAction: null;
  actionLabel: "View";
  actionHref: string;
};

export type DocumentsRow = DocumentListItem | ProgramTermsListItem;

export type DocumentLabelGroup = {
  label: string;
  count: number;
};

export type DocumentsPageData = {
  companyName: string;
  canMutate: boolean;
  /** Full library (all statuses). Tabs/filters derive the visible list client-side. */
  items: DocumentListItem[];
  /** True when any item has documentKind program_terms (suppresses virtual row). */
  hasRealProgramTerms: boolean;
  /**
   * When the partner accepted terms/agreement (onboarding). Used as the Date
   * on the virtual Program Terms row when no dated terms document exists.
   */
  programTermsAcceptedAt: string | null;
  /** Real documents only — never includes the virtual Program Terms row. */
  actionNeededCount: number;
  labelGroups: DocumentLabelGroup[];
  allLabels: string[];
  /** Initial URL filters; DocumentsView owns live tab/filter state. */
  filters: DocumentListFilters;
  agreementDocumentId: string | null;
};

export type DocumentDetailData = {
  id: string;
  title: string;
  status: DocumentStatus;
  labels: string[];
  version: number;
  effectiveDateLabel: string;
  signedDateLabel: string;
  expirationDateLabel: string;
  externalSignatureRef: string;
  typeLabel: string;
  documentKind: PartnerDocumentKind;
  supersedesTitle: string | null;
  /** When this row was superseded, open the successor instead. */
  supersededByDocumentId: string | null;
  sharedByLabel: string;
  fileUrl: string;
  previewKind: "pdf" | "image" | "other";
  canMutate: boolean;
  isOwnUpload: boolean;
  showGovernsTerms: boolean;
  neededAction: DocumentNeededAction;
  companyName: string;
};

export type ProgramTermsPriorVersion = {
  id: string;
  title: string;
  version: number;
  dateLabel: string;
  href: string;
};

export type ProgramTermsDetail = {
  program: string;
  programTitle: string;
  governedByLabel: string;
  commissionRateLabel: string;
  attributionWindowLabel: string;
  eligiblePeriodLabel: string;
  cookieRuleLabel: string;
  eligibleRevenueLabel: string;
  excludedRevenueLabel: string;
  paymentTermsLabel: string;
  refundsLabel: string;
  activePrograms: { value: string; label: string }[];
  priorVersions: ProgramTermsPriorVersion[];
};

function one(value: string | string[] | undefined): string | undefined {
  return typeof value === "string" ? value : undefined;
}

export function parseDocumentsTab(
  value: string | string[] | undefined,
): DocumentsTab {
  const raw = one(value);
  if (
    raw === "action-needed" ||
    raw === "labels" ||
    raw === "archived"
  ) {
    return raw;
  }
  return "all";
}

export function parseDocumentStatus(
  value: string | string[] | undefined,
): DocumentStatusFilter {
  const raw = one(value);
  if (
    raw === "current" ||
    raw === "action_needed" ||
    raw === "completed" ||
    raw === "archived"
  ) {
    return raw;
  }
  return "all";
}

export function parseDocumentProgram(
  value: string | string[] | undefined,
): DocumentProgramFilter {
  const raw = one(value);
  if (raw === "academy" || raw === "platform" || raw === "enterprise") {
    return raw;
  }
  return "all";
}

export function parseDocumentRange(
  value: string | string[] | undefined,
): DocumentDateRange {
  const raw = one(value);
  if (raw === "30" || raw === "90") return raw;
  return "all";
}

export function parseDocumentFilters(
  searchParams?: Record<string, string | string[] | undefined>,
): DocumentListFilters {
  return {
    tab: parseDocumentsTab(searchParams?.tab),
    status: parseDocumentStatus(searchParams?.status),
    program: parseDocumentProgram(searchParams?.program),
    label: (one(searchParams?.label) ?? "").trim(),
    range: parseDocumentRange(searchParams?.range),
    q: (one(searchParams?.q) ?? "").trim(),
  };
}

export function filtersAreDefault(filters: DocumentListFilters): boolean {
  return (
    filters.status === "all" &&
    filters.program === "all" &&
    !filters.label &&
    filters.range === "all" &&
    !filters.q
  );
}

export function documentsListHref(
  overrides: Partial<DocumentListFilters> & { tab?: DocumentsTab },
  base?: DocumentListFilters,
): string {
  const next: DocumentListFilters = {
    tab: overrides.tab ?? base?.tab ?? "all",
    status: overrides.status ?? base?.status ?? "all",
    program: overrides.program ?? base?.program ?? "all",
    label: overrides.label ?? base?.label ?? "",
    range: overrides.range ?? base?.range ?? "all",
    q: overrides.q ?? base?.q ?? "",
  };
  const params = new URLSearchParams();
  if (next.tab !== "all") params.set("tab", next.tab);
  if (next.status !== "all") params.set("status", next.status);
  if (next.program !== "all") params.set("program", next.program);
  if (next.label) params.set("label", next.label);
  if (next.range !== "all") params.set("range", next.range);
  if (next.q) params.set("q", next.q);
  const qs = params.toString();
  return qs ? `/partner-center/documents?${qs}` : "/partner-center/documents";
}
