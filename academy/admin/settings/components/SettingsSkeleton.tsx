import { SkeletonBlock, SkeletonHeader, SkeletonPage } from "@/academy/components/ui";

export function SettingsSkeleton() {
  return (
    <SkeletonPage label="Loading Academy settings…" className="max-w-[860px]">
      <SkeletonHeader />
      <div className="space-y-10">
        <SkeletonBlock className="h-[148px] rounded-[10px]" />
        <div>
          <SkeletonBlock className="h-4 w-48" />
          <SkeletonBlock className="mt-3 h-[148px] rounded-[10px]" />
        </div>
        <div>
          <SkeletonBlock className="h-4 w-32" />
          <SkeletonBlock className="mt-3 h-[88px] rounded-[10px]" />
        </div>
      </div>
    </SkeletonPage>
  );
}
