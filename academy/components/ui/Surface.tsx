import { cn } from "@/base/lib/cn";

const CARD_SHADOW = "0 1px 2px rgba(15,15,15,.04), 0 8px 24px rgba(15,15,15,.035)";

/** Bordered white container — the default Academy card. */
export function Surface({
  children,
  className,
  padded = false,
  elevated = false,
}: {
  children: React.ReactNode;
  className?: string;
  padded?: boolean;
  elevated?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-[12px] border border-line bg-surface",
        padded && "px-5 py-[18px]",
        className,
      )}
      style={elevated ? { boxShadow: CARD_SHADOW } : undefined}
    >
      {children}
    </div>
  );
}

/** Surface that hosts hairline-divided rows (queues, lists, tables). */
export function SurfaceList({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-[12px] border border-line bg-surface",
        "[&>*+*]:border-t [&>*+*]:border-line",
        className,
      )}
      style={{ boxShadow: CARD_SHADOW }}
    >
      {children}
    </div>
  );
}
