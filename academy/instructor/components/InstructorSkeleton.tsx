import { SkeletonBlock, SkeletonHeader, SkeletonPage, SkeletonStatGrid } from "@/academy/components/ui";

export function InstructorSkeleton({ showStats = true }: { showStats?: boolean }) {
  return (
    <SkeletonPage label="Loading your assigned programs…">
      <SkeletonHeader eyebrow={false} />
      <div className="space-y-6">
        {showStats ? <SkeletonStatGrid /> : null}
        <div
          className="overflow-hidden rounded-[12px] bg-surface"
          style={{ border: "1px solid var(--border)" }}
        >
          <div className="border-b px-5 py-4 sm:px-6" style={{ borderColor: "var(--border)" }}>
            <SkeletonBlock className="h-5 w-44" />
            <SkeletonBlock className="mt-2 h-4 w-72 max-w-full" />
          </div>
          <SkeletonBlock className="h-[220px] rounded-none" />
        </div>
      </div>
    </SkeletonPage>
  );
}
