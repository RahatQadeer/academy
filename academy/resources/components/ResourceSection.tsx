import type { ReactNode } from "react";

export function ResourceSection({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section
      className="overflow-hidden rounded-[16px] border border-line bg-surface"
      style={{ boxShadow: "0 1px 2px rgba(15,15,15,.035), 0 10px 28px rgba(15,15,15,.03)" }}
    >
      <div
        className="grid gap-4 border-b border-line px-5 py-5 sm:grid-cols-[minmax(0,1fr)_minmax(220px,280px)] sm:items-start sm:gap-6 sm:px-6"
        style={{
          background:
            "linear-gradient(135deg, color-mix(in srgb, var(--module-academy-bg) 48%, white) 0%, var(--surface) 72%)",
        }}
      >
        <div className="min-w-0">
          <h2
            className="text-[12px] font-semibold uppercase tracking-[0.07em]"
            style={{ color: "var(--module-academy-fg)" }}
          >
            {title}
          </h2>
          {description ? (
            <p
              className="mt-2 max-w-[58ch] text-[13.5px] leading-relaxed text-justify text-pretty"
              style={{ color: "var(--text-secondary)" }}
            >
              {description}
            </p>
          ) : null}
        </div>

        {action ? (
          <div
            className="rounded-[12px] border border-line bg-surface p-3.5"
            style={{ boxShadow: "0 1px 2px rgba(15,15,15,.04)" }}
          >
            {action}
          </div>
        ) : null}
      </div>

      <div className="px-5 py-5 sm:px-6 sm:py-6">{children}</div>
    </section>
  );
}
