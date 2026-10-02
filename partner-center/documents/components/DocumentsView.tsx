"use client";

import { useState } from "react";
import { Button } from "@/base/components/Button";
import { PartnerChrome } from "@/partner-center/components/PartnerChrome";
import { DocumentsFilters } from "@/partner-center/documents/components/DocumentsFilters";
import { DocumentsTable } from "@/partner-center/documents/components/DocumentsTable";
import { DocumentsTabs } from "@/partner-center/documents/components/DocumentsTabs";
import { MyLabelsPanel } from "@/partner-center/documents/components/MyLabelsPanel";
import { UploadDocumentModal } from "@/partner-center/documents/components/UploadDocumentModal";
import { deriveDocumentRows } from "@/partner-center/documents/lib/filter-documents";
import {
  documentsListHref,
  filtersAreDefault,
  type DocumentListFilters,
  type DocumentsPageData,
  type DocumentsTab,
} from "@/partner-center/documents/types";

/** F45 Documents list — layout from Partner Center HTML reference. */
export function DocumentsView({ data }: { data: DocumentsPageData }) {
  const [uploading, setUploading] = useState(false);
  const [filters, setFilters] = useState<DocumentListFilters>(data.filters);

  function updateFilters(next: Partial<DocumentListFilters>) {
    const merged = { ...filters, ...next };
    setFilters(merged);
    window.history.replaceState(null, "", documentsListHref(merged));
  }

  function selectTab(tab: DocumentsTab) {
    updateFilters({ tab });
  }

  const rows = deriveDocumentRows(
    data.items,
    filters,
    data.hasRealProgramTerms,
    data.programTermsAcceptedAt,
  );
  const defaults = filtersAreDefault(filters);

  const emptyMessage =
    filters.tab === "archived"
      ? "No archived documents."
      : filters.tab === "action-needed"
        ? "Nothing needs your attention right now."
        : defaults
          ? "Files you upload, and files Private Attaché shares with you, will appear here."
          : "No documents match these filters.";

  return (
    <div className="flex min-h-full flex-col px-5 py-6 sm:px-6 lg:px-8 xl:px-12">
      <PartnerChrome
        title="Documents"
        subtitle={`Agreements, terms, tax forms, and shared files for ${data.companyName}.`}
        action={
          data.canMutate ? (
            <Button
              type="button"
              variant="primary"
              className="px-4 py-[9px] text-[13.5px]"
              onClick={() => setUploading(true)}
            >
              Upload document
            </Button>
          ) : undefined
        }
      />

      <DocumentsTabs
        active={filters.tab}
        actionNeededCount={data.actionNeededCount}
        onChange={selectTab}
      />

      {filters.tab === "labels" ? (
        <MyLabelsPanel
          groups={data.labelGroups}
          canMutate={data.canMutate}
          onSelectLabel={(label) => updateFilters({ tab: "all", label })}
        />
      ) : (
        <>
          <DocumentsFilters
            filters={filters}
            labels={data.allLabels}
            onChange={updateFilters}
          />
          <DocumentsTable rows={rows} emptyMessage={emptyMessage} />
        </>
      )}

      {uploading ? (
        <UploadDocumentModal
          existingLabels={data.allLabels}
          onClose={() => setUploading(false)}
        />
      ) : null}
    </div>
  );
}
