export function QuizSkeleton() {
  return (
    <div className="animate-pulse space-y-3">
      <div className="h-4 w-32 rounded" style={{ background: "var(--border)" }} />
      <div className="h-28 rounded-[8px]" style={{ background: "var(--border)" }} />
      <div className="h-28 rounded-[8px]" style={{ background: "var(--border)" }} />
    </div>
  );
}
