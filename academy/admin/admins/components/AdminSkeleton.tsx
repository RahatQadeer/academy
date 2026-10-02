import { SkeletonBlock, SkeletonHeader, SkeletonPage } from "@/academy/components/ui";

export function AdminSkeleton() {
  return (
    <SkeletonPage label="Loading Academy Admins…">
      <SkeletonBlock className="mb-8 h-4 w-24" />
      <SkeletonHeader />
      <div className="space-y-8">
        <SkeletonBlock className="h-[132px] rounded-[10px]" />
        <SkeletonBlock className="h-[180px] rounded-[10px]" />
      </div>
    </SkeletonPage>
  );
}
