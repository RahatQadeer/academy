export function ProgressBar({ value, tone = "default" }: { value: number; tone?: "default" | "success" }) {
  const width = Math.max(0, Math.min(100, value));
  const fill = tone === "success" ? "var(--success-fg)" : undefined;
  return (
    <div
      className="h-1 w-full overflow-hidden rounded-[2px]"
      style={{ background: "var(--border)" }}
    >
      <div
        className={tone === "success" ? "h-full" : "h-full bg-accent"}
        style={fill ? { width: `${width}%`, background: fill } : { width: `${width}%` }}
      />
    </div>
  );
}
