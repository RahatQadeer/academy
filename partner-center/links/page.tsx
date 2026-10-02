import { Suspense } from "react";
import { PartnerPageSkeleton } from "@/partner-center/components/states/PartnerPageSkeleton";
import { LinksPageContent } from "@/partner-center/links/links-content";

export default function PartnerLinksPage() {
  return (
    <Suspense fallback={<PartnerPageSkeleton variant="simple" />}>
      <LinksPageContent />
    </Suspense>
  );
}
