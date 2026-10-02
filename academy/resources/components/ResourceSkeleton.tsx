import { SkeletonBlock, SkeletonPage } from "@/academy/components/ui";

export function ResourceSkeleton() {
  return (
    <SkeletonPage label="Loading your resources…">
      <SkeletonBlock className="mb-7 h-[140px] w-full rounded-[16px]" />
      <div className="space-y-6">
        <SkeletonBlock className="h-[280px] rounded-[16px]" />
        <SkeletonBlock className="h-[180px] rounded-[16px]" />
      </div>
    </SkeletonPage>
  );
}
