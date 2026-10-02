import { cn } from "@/base/lib/cn";

/** Quiet inline placeholder for a section or tab with nothing in it yet. */
export function EmptyNote({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="rounded-[8px] border border-line px-4 py-8 text-center text-[13.5px]"
      style={{ color: "var(--text-tertiary)" }}
    >
      {children}
    </div>
  );
}

/** Section heading inside a tab, e.g. "Open Requests". */
export function SectionTitle({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <h2 className={cn("mb-3 text-[14px] font-semibold", className)}>{children}</h2>
  );
}
