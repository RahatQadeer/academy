import { SkeletonBlock, SkeletonHeader, SkeletonPage } from "@/academy/components/ui";

function BankSkeleton() {
  return (
    <div
      className="overflow-hidden rounded-[12px] bg-surface"
      style={{
        border: "1px solid var(--border)",
        boxShadow: "0 1px 2px rgba(15,15,15,.04), 0 8px 24px rgba(15,15,15,.035)",
      }}
    >
      <div
        className="border-b px-5 py-5 sm:px-6"
        style={{
          borderColor: "var(--border)",
          background:
            "linear-gradient(180deg, color-mix(in srgb, #e9e4f3 34%, white) 0%, var(--surface) 100%)",
        }}
      >
        <div className="flex flex-col gap-3 lg:flex-row">
          <SkeletonBlock className="h-10 w-full rounded-[10px] lg:w-56" />
          <SkeletonBlock className="h-10 w-full rounded-[10px]" />
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <SkeletonBlock className="h-16 rounded-[10px]" />
          <SkeletonBlock className="h-16 rounded-[10px]" />
          <SkeletonBlock className="h-16 rounded-[10px]" />
        </div>
      </div>

      <div className="px-5 py-5 sm:px-6">
        <SkeletonBlock className="h-3 w-16" />
        <SkeletonBlock className="mt-2 h-6 w-44" />
        <SkeletonBlock className="mt-3 h-3.5 w-80 max-w-full" />
        <SkeletonBlock className="mt-5 h-8 w-full max-w-md rounded-[12px]" />
      </div>

      {Array.from({ length: 5 }).map((_, index) => (
        <div
          key={index}
          className="flex items-start gap-3 border-t px-5 py-3.5 sm:px-6"
          style={{ borderColor: "var(--border)" }}
        >
          <SkeletonBlock className="mt-1 h-[18px] w-[18px] rounded-[5px]" />
          <SkeletonBlock className="h-9 w-9 rounded-[10px]" />
          <div className="min-w-0 flex-1">
            <SkeletonBlock className="h-4 w-[72%] max-w-[22rem]" />
            <SkeletonBlock className="mt-2 h-3 w-32" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function QuestionBankResultsSkeleton() {
  return <BankSkeleton />;
}

export function QuestionBankSkeleton() {
  return (
    <SkeletonPage label="Loading question bank…">
      <SkeletonHeader eyebrow={false} />
      <QuestionBankResultsSkeleton />
    </SkeletonPage>
  );
}
