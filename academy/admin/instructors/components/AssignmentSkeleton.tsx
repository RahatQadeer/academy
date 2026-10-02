import { SkeletonBlock, SkeletonHeader, SkeletonPage } from "@/academy/components/ui";

export function AssignmentSkeleton() {
  return (
    <SkeletonPage label="Loading Academy Instructors…">
      <SkeletonHeader eyebrow={false} />
      <div className="space-y-6">
        <div
          className="overflow-hidden rounded-[12px] bg-surface"
          style={{ border: "1px solid var(--border)" }}
        >
          <div className="border-b px-5 py-4 sm:px-6" style={{ borderColor: "var(--border)" }}>
            <SkeletonBlock className="h-5 w-40" />
          </div>
          <SkeletonBlock className="h-[220px] rounded-none" />
        </div>
      </div>
    </SkeletonPage>
  );
}
