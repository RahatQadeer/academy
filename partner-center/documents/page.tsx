import { Suspense } from "react";
import { PartnerPageSkeleton } from "@/partner-center/components/states/PartnerPageSkeleton";
import { DocumentsPageContent } from "@/partner-center/documents/documents-content";

type SearchParams = Record<string, string | string[] | undefined>;

export default function PartnerDocumentsPage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  return (
    <Suspense fallback={<PartnerPageSkeleton variant="table" />}>
      <DocumentsPageContent searchParams={searchParams} />
    </Suspense>
  );
}
