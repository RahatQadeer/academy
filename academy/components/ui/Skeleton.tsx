import { cn } from "@/base/lib/cn";

/** A single shimmering placeholder block. */
export function SkeletonBlock({ className }: { className?: string }) {
  return <div className={cn("rounded", className)} style={{ background: "var(--border)" }} />;
}

/**
 * Wraps a loading layout with the pulse animation and announces the wait
 * to assistive tech. Children should mirror the real layout so nothing shifts.
 */
export function SkeletonPage({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("px-5 py-8 sm:px-7 lg:px-10 lg:py-9", className)} aria-busy="true" aria-live="polite">
      <span className="sr-only">{label}</span>
      <div className="animate-pulse">{children}</div>
    </div>
  );
}

/** Header placeholder matching PageHeader's rhythm. */
export function SkeletonHeader({ eyebrow = true }: { eyebrow?: boolean }) {
  return (
    <div className="mb-8">
      {eyebrow ? <SkeletonBlock className="h-3 w-28" /> : null}
      <SkeletonBlock className={cn("h-7 w-48", eyebrow && "mt-3")} />
      <SkeletonBlock className="mt-3 h-4 w-[30rem] max-w-full" />
    </div>
  );
}

/** Stat row placeholder matching StatGrid. */
export function SkeletonStatGrid({ count = 4 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: count }, (_, index) => (
        <SkeletonBlock key={index} className="h-[132px] rounded-[12px]" />
      ))}
    </div>
  );
}

/** Divided-list placeholder matching SurfaceList. */
export function SkeletonList({ rows = 3 }: { rows?: number }) {
  return (
    <div className="overflow-hidden rounded-[10px] border border-line bg-surface">
      {Array.from({ length: rows }, (_, index) => (
        <div
          key={index}
          className="flex items-center gap-3.5 px-5 py-5"
          style={index > 0 ? { borderTop: "1px solid var(--border)" } : undefined}
        >
          <SkeletonBlock className="h-10 w-10 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1">
            <SkeletonBlock className="h-4 w-1/3 min-w-[120px]" />
            <SkeletonBlock className="mt-2 h-3 w-2/3 min-w-[160px]" />
          </div>
          <SkeletonBlock className="hidden h-3 w-16 shrink-0 sm:block" />
        </div>
      ))}
    </div>
  );
}
