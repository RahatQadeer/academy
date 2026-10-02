import { SkeletonBlock, SkeletonHeader, SkeletonPage } from "@/academy/components/ui";

function CardSkeleton() {
  return (
    <div
      className="overflow-hidden rounded-[12px] bg-surface"
      style={{ border: "1px solid var(--border)" }}
    >
      <div className="border-b px-5 py-4 sm:px-6" style={{ borderColor: "var(--border)" }}>
        <SkeletonBlock className="h-5 w-40" />
        <SkeletonBlock className="mt-2 h-4 w-72 max-w-full" />
      </div>
      <SkeletonBlock className="h-[180px] rounded-none" />
    </div>
  );
}

export function CredentialsSkeleton() {
  return (
    <SkeletonPage label="Loading credentials…">
      <SkeletonHeader eyebrow={false} />
      <div className="space-y-6">
        <CardSkeleton />
        <CardSkeleton />
      </div>
    </SkeletonPage>
  );
}
