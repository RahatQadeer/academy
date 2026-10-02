export function LessonPlayerSkeleton() {
  return (
    <div className="animate-pulse lg:flex lg:h-screen">
      <div
        className="h-12 shrink-0 lg:h-full lg:w-[300px] lg:border-r"
        style={{ background: "var(--surface-soft)", borderColor: "var(--border)" }}
      />
      <div className="flex-1 bg-surface">
        <div className="border-b px-10 py-5" style={{ borderColor: "var(--border)" }}>
          <div className="h-3 w-40 rounded" style={{ background: "var(--border)" }} />
          <div className="mt-3 h-7 w-2/3 rounded" style={{ background: "var(--border)" }} />
        </div>
        <div className="max-w-[920px] space-y-4 px-10 py-8">
          <div className="aspect-video rounded-[12px]" style={{ background: "var(--surface-soft)" }} />
          <div className="h-4 w-full rounded" style={{ background: "var(--border)" }} />
          <div className="h-4 w-5/6 rounded" style={{ background: "var(--border)" }} />
          <div className="h-28 rounded-[10px]" style={{ background: "var(--surface-soft)" }} />
        </div>
      </div>
    </div>
  );
}
