import { SkeletonBlock, SkeletonHeader, SkeletonPage } from "@/academy/components/ui";

export function ExploreSkeleton() {
  return (
    <SkeletonPage label="Loading the Academy catalog…" className="mx-auto max-w-[1280px]">
      <SkeletonHeader eyebrow={false} />
      <div
        className="rounded-[12px] bg-surface px-4 py-4 sm:px-5"
        style={{ border: "1px solid var(--border)" }}
      >
        <SkeletonBlock className="h-12 w-full rounded-[10px]" />
        <div className="mt-4 flex flex-wrap gap-2">
          <SkeletonBlock className="h-8 w-16 rounded-full" />
          <SkeletonBlock className="h-8 w-24 rounded-full" />
          <SkeletonBlock className="h-8 w-24 rounded-full" />
          <SkeletonBlock className="h-8 w-28 rounded-full" />
        </div>
      </div>
      <div className="mt-8 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {[0, 1, 2, 3, 4, 5].map((key) => (
          <div
            key={key}
            className="overflow-hidden rounded-[12px] bg-surface"
            style={{ border: "1px solid var(--border)" }}
          >
            <SkeletonBlock className="aspect-[16/10] rounded-none" />
            <div className="space-y-3 p-4">
              <SkeletonBlock className="h-3 w-16" />
              <SkeletonBlock className="h-4 w-full" />
              <SkeletonBlock className="h-3 w-3/4" />
              <SkeletonBlock className="h-9 w-full rounded-[6px]" />
            </div>
          </div>
        ))}
      </div>
    </SkeletonPage>
  );
}
