import {
  SkeletonBlock,
  SkeletonHeader,
  SkeletonList,
  SkeletonPage,
  SkeletonStatGrid,
} from "@/academy/components/ui";

export function AdminSkeleton() {
  return (
    <SkeletonPage label="Loading the Academy admin dashboard…">
      <SkeletonHeader eyebrow={false} />

      <div className="space-y-6">
        <SkeletonStatGrid />
        <SkeletonBlock className="h-[88px] rounded-[12px]" />
        <div className="grid gap-4 lg:grid-cols-2">
          <SkeletonList rows={4} />
          <SkeletonList rows={4} />
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }, (_, index) => (
            <SkeletonBlock key={index} className="h-[76px] rounded-[12px]" />
          ))}
        </div>
      </div>
    </SkeletonPage>
  );
}

/** Compact loading shell for Super Admin list pages (Users, Activity log). */
export function AdminListSkeleton() {
  return (
    <SkeletonPage label="Loading…">
      <div className="mx-auto max-w-[920px] space-y-6">
        <SkeletonBlock className="h-8 w-36" />
        <SkeletonBlock className="h-[72px] rounded-[14px]" />
        <div className="space-y-2.5">
          <SkeletonBlock className="h-[76px] rounded-[14px]" />
          <SkeletonBlock className="h-[76px] rounded-[14px]" />
          <SkeletonBlock className="h-[76px] rounded-[14px]" />
        </div>
      </div>
    </SkeletonPage>
  );
}
