import { Suspense } from "react";
import { PartnerPageSkeleton } from "@/partner-center/components/states/PartnerPageSkeleton";
import { MessagesPageContent } from "@/partner-center/messages/messages-content";

export default function PartnerMessagesPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  return (
    <Suspense fallback={<PartnerPageSkeleton variant="table" />}>
      <MessagesPageContent searchParams={searchParams} />
    </Suspense>
  );
}
