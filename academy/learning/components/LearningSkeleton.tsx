import { SkeletonBlock, SkeletonHeader, SkeletonPage } from "@/academy/components/ui";

export function LearningSkeleton() {
  return (
    <SkeletonPage label="Loading your enrolled programs…">
      <SkeletonHeader eyebrow={false} />
      <div className="space-y-3">
        <SkeletonBlock className="h-[106px] rounded-[10px]" />
        <SkeletonBlock className="h-[106px] rounded-[10px]" />
        <SkeletonBlock className="h-[106px] rounded-[10px]" />
      </div>
    </SkeletonPage>
  );
}
