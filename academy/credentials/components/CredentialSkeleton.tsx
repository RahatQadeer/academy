import { SkeletonBlock, SkeletonHeader, SkeletonPage } from "@/academy/components/ui";

function SectionSkeleton() {
  return (
    <div
      className="overflow-hidden rounded-[12px] bg-surface"
      style={{ border: "1px solid var(--border)" }}
    >
      <div className="border-b px-5 py-3" style={{ borderColor: "var(--border)" }}>
        <SkeletonBlock className="h-4 w-40" />
      </div>
      <SkeletonBlock className="h-[56px] rounded-none" />
    </div>
  );
}

export function CredentialSkeleton() {
  return (
    <SkeletonPage label="Loading your certificates and credentials…">
      <SkeletonHeader eyebrow={false} />
      <div className="space-y-4">
        <SectionSkeleton />
        <SectionSkeleton />
        <SectionSkeleton />
      </div>
    </SkeletonPage>
  );
}
