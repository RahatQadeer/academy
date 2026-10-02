export function ProgramEditorSkeleton() {
  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <div
        className="h-[48px] animate-pulse border-b"
        style={{ borderColor: "var(--border)", background: "var(--surface)" }}
      />
      <div
        className="h-[42px] animate-pulse border-b"
        style={{ borderColor: "var(--border)", background: "var(--surface)" }}
      />
      <div className="flex flex-1">
        <div className="w-[268px] animate-pulse border-r" style={{ borderColor: "var(--border)" }} />
        <div className="flex-1 p-8">
          <div className="h-6 w-48 animate-pulse rounded bg-border" />
          <div className="mt-4 h-[300px] animate-pulse rounded bg-border" />
        </div>
      </div>
    </div>
  );
}
