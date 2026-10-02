import { cn } from "@/base/lib/cn";

/**
 * The page container for every Academy surface.
 *
 * `default` — dashboards, queues, detail views: full-bleed with sidebar-aware padding.
 * `wide`    — catalog browsing (Explore): centred, capped, so cards stay a readable width
 *             on very large displays instead of stretching edge to edge.
 */
export function PageShell({
  children,
  variant = "default",
  className,
}: {
  children: React.ReactNode;
  variant?: "default" | "wide";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "overflow-x-clip",
        variant === "wide"
          ? "mx-auto w-full max-w-[1280px] px-5 py-8 sm:px-6 lg:px-8"
          : "max-w-full px-5 py-8 sm:px-7 lg:px-10 lg:py-9",
        className,
      )}
    >
      {children}
    </div>
  );
}
