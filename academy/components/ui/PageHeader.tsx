import { cn } from "@/base/lib/cn";

/**
 * Academy page header. One type scale for every surface:
 * eyebrow 12px/600 uppercase, title 28px/700, description 14px/1.6.
 */
export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
  eyebrowTone = "academy",
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
  eyebrowTone?: "academy" | "neutral";
}) {
  return (
    <header className={cn("mb-8", className)}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          {eyebrow ? (
            <p
              className="mb-2 text-[12px] font-semibold uppercase tracking-[0.06em]"
              style={{
                color:
                  eyebrowTone === "neutral"
                    ? "var(--text-tertiary)"
                    : "var(--module-academy-fg)",
              }}
            >
              {eyebrow}
            </p>
          ) : null}
          <h1 className="text-[26px] font-bold leading-[1.15] tracking-[-0.5px] text-pretty sm:text-[28px]">
            {title}
          </h1>
          {description ? (
            <p
              className="mt-2 max-w-[68ch] text-[14px] leading-[1.6] text-pretty"
              style={{ color: "var(--text-secondary)" }}
            >
              {description}
            </p>
          ) : null}
        </div>
        {actions ? (
          <div className="flex shrink-0 flex-wrap items-center gap-2 self-start sm:self-auto">
            {actions}
          </div>
        ) : null}
      </div>
    </header>
  );
}

/** Uppercase micro-heading that labels a block within a page. */
export function SectionHeading({
  id,
  children,
  className,
}: {
  id?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <h2
      id={id}
      className={cn(
        "mb-3 text-[12px] font-semibold uppercase tracking-[0.06em]",
        className,
      )}
      style={{ color: "var(--text-tertiary)" }}
    >
      {children}
    </h2>
  );
}

/** Larger in-page section title with supporting copy and an optional action. */
export function SectionHeader({
  id,
  title,
  description,
  actions,
}: {
  id?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h2
          id={id}
          className="text-[19px] font-semibold leading-tight tracking-[-0.3px] text-pretty"
          style={{ color: "var(--ink)" }}
        >
          {title}
        </h2>
        {description ? (
          <p
            className="mt-1.5 max-w-[64ch] text-[13.5px] leading-relaxed text-pretty"
            style={{ color: "var(--text-secondary)" }}
          >
            {description}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2 self-start sm:self-auto">
          {actions}
        </div>
      ) : null}
    </div>
  );
}
