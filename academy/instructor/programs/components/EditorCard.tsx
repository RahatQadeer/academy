import type { ReactNode } from "react";

export const EDITOR_CARD_SHADOW = "0 1px 2px rgba(15,15,15,.04), 0 8px 24px rgba(15,15,15,.035)";

export function EditorCard({
  title,
  description,
  actions,
  children,
  padded = true,
}: {
  title?: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  padded?: boolean;
}) {
  return (
    <section
      className="overflow-hidden rounded-[12px] bg-surface"
      style={{ border: "1px solid var(--border)", boxShadow: EDITOR_CARD_SHADOW }}
    >
      {title ? (
        <div
          className="flex items-end justify-between gap-3 border-b px-5 py-4"
          style={{ borderColor: "var(--border)" }}
        >
          <div className="min-w-0">
            <h2 className="text-[16px] font-semibold tracking-[-0.2px]">{title}</h2>
            {description ? (
              <p className="mt-1 text-[13px]" style={{ color: "var(--text-secondary)" }}>
                {description}
              </p>
            ) : null}
          </div>
          {actions ? <div className="shrink-0">{actions}</div> : null}
        </div>
      ) : null}
      <div className={padded ? "p-5" : undefined}>{children}</div>
    </section>
  );
}
