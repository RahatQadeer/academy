import {
  formatDocumentDate,
  matchesProgramFilter,
} from "@/partner-center/documents/lib/format";
import type {
  DocumentListFilters,
  DocumentListItem,
  DocumentsRow,
  ProgramTermsListItem,
} from "@/partner-center/documents/types";
import { filtersAreDefault } from "@/partner-center/documents/types";

function withinRange(iso: string | null, range: string): boolean {
  if (range === "all") return true;
  if (!iso) return false;
  const days = range === "30" ? 30 : 90;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return false;
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  return then >= cutoff;
}

export function virtualProgramTermsRow(
  acceptedAt: string | null = null,
): ProgramTermsListItem {
  const dateIso = acceptedAt?.trim() || null;
  return {
    kind: "program_terms",
    id: "terms",
    title: "Program Terms — Referral Program",
    status: "current",
    labels: ["Terms"],
    programLabel: "Whitby",
    documentKind: "program_terms",
    dateIso,
    dateLabel: formatDocumentDate(dateIso),
    neededAction: null,
    actionLabel: "View",
    actionHref: "/partner-center/documents/terms",
  };
}

/** Client-side list derivation — same rules as the former server filter path. */
export function deriveDocumentRows(
  items: DocumentListItem[],
  filters: DocumentListFilters,
  hasRealProgramTerms = false,
  programTermsAcceptedAt: string | null = null,
): DocumentsRow[] {
  if (filters.tab === "labels") return [];

  let filtered = items;

  if (filters.tab === "action-needed") {
    filtered = filtered.filter((item) => item.status === "action_needed");
  } else if (filters.tab === "archived") {
    filtered = filtered.filter((item) => item.status === "archived");
  } else if (filters.tab === "all") {
    filtered = filtered.filter((item) => item.status !== "archived");
  }

  if (filters.status !== "all") {
    filtered = filtered.filter((item) => item.status === filters.status);
  }

  if (filters.program !== "all") {
    filtered = filtered.filter((item) =>
      matchesProgramFilter(item.programLabel, filters.program),
    );
  }

  if (filters.label) {
    filtered = filtered.filter((item) =>
      item.labels.some((label) => label === filters.label),
    );
  }

  if (filters.range !== "all") {
    filtered = filtered.filter((item) =>
      withinRange(item.dateIso, filters.range),
    );
  }

  if (filters.q) {
    const q = filters.q.toLowerCase();
    filtered = filtered.filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        item.labels.some((label) => label.toLowerCase().includes(q)),
    );
  }

  const rows: DocumentsRow[] = [...filtered];

  if (
    filters.tab === "all" &&
    filtersAreDefault(filters) &&
    !hasRealProgramTerms
  ) {
    rows.unshift(virtualProgramTermsRow(programTermsAcceptedAt));
  }

  return rows;
}
