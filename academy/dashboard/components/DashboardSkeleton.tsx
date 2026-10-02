import { SkeletonBlock, SkeletonPage } from "@/academy/components/ui";

export function DashboardSkeleton() {
  return (
    <SkeletonPage label="Loading your Academy dashboard…">
      <div className="mb-8">
        <SkeletonBlock className="h-3 w-20" />
        <SkeletonBlock className="mt-2 h-7 w-52" />
      </div>
      <div className="space-y-7">
        <SkeletonBlock className="h-[68px] w-full rounded-[12px]" />
        <div>
          <SkeletonBlock className="h-3 w-32" />
          <div className="mt-3 grid gap-3.5 md:grid-cols-2">
            <SkeletonBlock className="h-[140px] rounded-[12px]" />
            <SkeletonBlock className="h-[140px] rounded-[12px]" />
          </div>
        </div>
        <div>
          <SkeletonBlock className="h-3 w-36" />
          <SkeletonBlock className="mt-3 h-[180px] w-full rounded-[12px]" />
        </div>
      </div>
    </SkeletonPage>
  );
}
