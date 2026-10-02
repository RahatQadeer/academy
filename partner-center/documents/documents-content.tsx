import { PartnerLoadError } from "@/partner-center/components/states/PartnerLoadError";
import { DocumentsView } from "@/partner-center/documents/components/DocumentsView";
import { loadDocumentsPage } from "@/partner-center/documents/lib/load-documents";
import { parseDocumentFilters } from "@/partner-center/documents/types";
import { requirePartnerAppAccess } from "@/partner-center/lib/access";

type SearchParams = Record<string, string | string[] | undefined>;

export async function DocumentsPageContent({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  const { context, user } = await requirePartnerAppAccess();
  const filters = parseDocumentFilters(searchParams);
  const result = await loadDocumentsPage(context, filters, user);
  if (!result.ok) {
    return (
      <PartnerLoadError
        retryHref="/partner-center/documents"
        message={result.error}
      />
    );
  }
  return <DocumentsView data={result.data} />;
}
