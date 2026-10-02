export function QuizSkeleton() {
  return (
    <div className="animate-pulse space-y-6 px-6 py-10 lg:px-14">
      <div className="h-4 w-32 rounded" style={{ background: "var(--border)" }} />
      <div className="h-7 w-64 rounded" style={{ background: "var(--border)" }} />
      <div className="h-24 rounded-[10px]" style={{ background: "var(--border)" }} />
      <div className="h-48 rounded-[10px]" style={{ background: "var(--border)" }} />
    </div>
  );
}
