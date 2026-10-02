import { SkeletonBlock, SkeletonHeader, SkeletonPage } from "@/academy/components/ui";

export function ReviewsSkeleton() {
  return (
    <SkeletonPage label="Loading assignment reviews…">
      <SkeletonHeader eyebrow={false} />
      <div className="overflow-hidden rounded-[12px] border border-line bg-surface">
        <div className="border-b border-line px-5 py-4 sm:px-6">
          <SkeletonBlock className="h-5 w-36" />
          <SkeletonBlock className="mt-2 h-4 w-80 max-w-full" />
          <div className="mt-4 flex gap-2">
            <SkeletonBlock className="h-8 w-24 rounded-[8px]" />
            <SkeletonBlock className="h-8 w-24 rounded-[8px]" />
            <SkeletonBlock className="h-8 w-24 rounded-[8px]" />
          </div>
        </div>
        <div className="border-b border-line px-5 py-4 sm:px-6">
          <div className="grid gap-3 sm:grid-cols-3">
            <SkeletonBlock className="h-9 rounded-[8px]" />
            <SkeletonBlock className="h-9 rounded-[8px]" />
            <SkeletonBlock className="h-9 rounded-[8px]" />
          </div>
        </div>
        {Array.from({ length: 5 }, (_, index) => (
          <div
            key={index}
            className="flex items-center gap-3 px-5 py-4 sm:px-6"
            style={index > 0 ? { borderTop: "1px solid var(--border)" } : undefined}
          >
            <SkeletonBlock className="h-9 w-9 shrink-0 rounded-full" />
            <div className="min-w-0 flex-1">
              <SkeletonBlock className="h-4 w-40" />
              <SkeletonBlock className="mt-2 h-3 w-56 max-w-full" />
            </div>
            <SkeletonBlock className="hidden h-5 w-20 sm:block" />
          </div>
        ))}
      </div>
    </SkeletonPage>
  );
}
