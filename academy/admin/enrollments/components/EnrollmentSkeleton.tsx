import { SkeletonBlock, SkeletonHeader, SkeletonPage } from "@/academy/components/ui";

export function EnrollmentSkeleton() {
  return (
    <SkeletonPage label="Loading enrollment totals…">
      <SkeletonHeader eyebrow={false} />
      <div
        className="overflow-hidden rounded-[10px] bg-surface"
        style={{ border: "1px solid var(--border)" }}
      >
        <div className="border-b px-5 py-4 sm:px-6" style={{ borderColor: "var(--border)" }}>
          <SkeletonBlock className="h-5 w-28" />
          <SkeletonBlock className="mt-2 h-4 w-72 max-w-full" />
        </div>
        <SkeletonBlock className="h-[280px] rounded-none" />
      </div>
    </SkeletonPage>
  );
}

export function ProgramEnrollmentSkeleton() {
  return (
    <SkeletonPage label="Loading program enrollments…">
      <SkeletonBlock className="mb-5 h-4 w-32" />
      <SkeletonHeader eyebrow />
      <div
        className="mb-5 grid grid-cols-2 gap-px overflow-hidden rounded-[10px] sm:grid-cols-4"
        style={{ border: "1px solid var(--border)", background: "var(--border)" }}
      >
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="bg-surface px-5 py-4">
            <SkeletonBlock className="h-3 w-16" />
            <SkeletonBlock className="mt-2.5 h-7 w-10" />
          </div>
        ))}
      </div>
      <div
        className="overflow-hidden rounded-[10px] bg-surface"
        style={{ border: "1px solid var(--border)" }}
      >
        <div className="border-b px-5 py-4 sm:px-6" style={{ borderColor: "var(--border)" }}>
          <SkeletonBlock className="h-5 w-28" />
          <SkeletonBlock className="mt-2 h-4 w-72 max-w-full" />
        </div>
        <SkeletonBlock className="h-[240px] rounded-none" />
      </div>
    </SkeletonPage>
  );
}
