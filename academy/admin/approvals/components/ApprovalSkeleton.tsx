import { SkeletonBlock, SkeletonHeader, SkeletonPage } from "@/academy/components/ui";

export function ApprovalSkeleton() {
  return (
    <SkeletonPage label="Loading the publish approval queue…">
      <SkeletonHeader eyebrow={false} />
      <div
        className="overflow-hidden rounded-[12px] bg-surface"
        style={{ border: "1px solid var(--border)" }}
      >
        <div className="border-b px-5 py-4 sm:px-6" style={{ borderColor: "var(--border)" }}>
          <SkeletonBlock className="h-6 w-64 max-w-full" />
          <SkeletonBlock className="mt-3 h-4 w-72 max-w-full" />
        </div>
        <SkeletonBlock className="h-[168px] rounded-none" />
      </div>
    </SkeletonPage>
  );
}
