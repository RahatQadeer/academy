import { cn } from "@/base/lib/cn";

/** The one card container used across the portal. Borders separate, not shadows. */
export function Card({
  children,
  className,
  padded = true,
}: {
  children: React.ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-card-cp border border-line bg-surface",
        padded && "p-4",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function SectionTitle({
  children,
  action,
}: {
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-3 mt-7 flex items-center justify-between gap-3 first:mt-0">
      {/* Whitby's group label — Integrations' "CALENDAR & EMAIL" — at its
          size, tracking and grey, so a section of the portal is announced the
          way a section of the professional's product is. */}
      <h2
        className="text-[12.5px] font-semibold uppercase tracking-[0.04em]"
        style={{ color: "var(--text-faint)" }}
      >
        {children}
      </h2>
      {action}
    </div>
  );
}

/** Vertically stacked rows inside one bordered surface, separated by hairlines. */
export function RowList({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "divide-y divide-line overflow-hidden rounded-card-cp border border-line bg-surface",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function Row({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-3 px-4 py-3", className)}>
      {children}
    </div>
  );
}

/** Meta line under a row title — request name, author, timestamp. */
export function RowMeta({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[12.5px]" style={{ color: "var(--text-tertiary)" }}>
      {children}
    </div>
  );
}
