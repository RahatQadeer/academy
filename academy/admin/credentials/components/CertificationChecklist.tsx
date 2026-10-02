import type { ChecklistItem } from "../types";

function CheckIcon({ complete }: { complete: boolean }) {
  return (
    <span
      className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
      style={{
        background: complete ? "var(--success-bg)" : "var(--surface)",
        color: complete ? "var(--success-fg)" : "var(--text-tertiary)",
        border: complete ? "none" : "1.5px solid var(--border-strong)",
        boxShadow: complete
          ? "0 0 0 3px color-mix(in srgb, var(--success-bg) 55%, transparent)"
          : undefined,
      }}
      aria-hidden
    >
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
        {complete ? (
          <path
            d="M2.5 6.2L4.8 8.5L9.5 3.5"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ) : (
          <circle cx="6" cy="6" r="1.25" fill="currentColor" />
        )}
      </svg>
    </span>
  );
}

export function CertificationChecklist({ items }: { items: ChecklistItem[] }) {
  const completeCount = items.filter((item) => item.complete).length;
  const progress = items.length === 0 ? 0 : Math.round((completeCount / items.length) * 100);
  const allComplete = items.length > 0 && completeCount === items.length;

  return (
    <section
      className="overflow-hidden rounded-[12px] bg-white"
      style={{ border: "1px solid var(--border)" }}
    >
      <div
        className="flex flex-wrap items-end justify-between gap-3 border-b px-5 py-4 sm:px-6"
        style={{
          borderColor: "var(--border)",
          background: allComplete
            ? "color-mix(in srgb, var(--success-bg) 28%, var(--surface))"
            : "var(--surface-subtle)",
        }}
      >
        <div>
          <h2
            className="text-[15.5px] font-semibold tracking-[-0.2px]"
            style={{ color: "var(--ink)" }}
          >
            Certification checklist
          </h2>
          <p className="mt-0.5 text-[13px]" style={{ color: "var(--text-secondary)" }}>
            {items.length === 0
              ? "No checklist items for this credential."
              : allComplete
                ? "All requirements met — ready for award."
                : `${completeCount} of ${items.length} requirements complete`}
          </p>
        </div>
        {items.length > 0 ? (
          <span
            className="rounded-[6px] px-2.5 py-1 text-[12px] font-semibold tabular-nums"
            style={{
              background: allComplete ? "var(--success-bg)" : "var(--surface)",
              color: allComplete ? "var(--success-fg)" : "var(--text-secondary)",
              border: `1px solid ${allComplete ? "transparent" : "var(--border)"}`,
            }}
          >
            {progress}%
          </span>
        ) : null}
      </div>

      {items.length > 0 ? (
        <div className="px-5 pt-4 sm:px-6">
          <div
            className="h-1 overflow-hidden rounded-full"
            style={{ background: "var(--border)" }}
            role="progressbar"
            aria-valuenow={progress}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Checklist progress"
          >
            <div
              className="h-full rounded-full transition-[width] duration-300"
              style={{
                width: `${progress}%`,
                background: allComplete ? "var(--success-fg)" : "var(--accent)",
              }}
            />
          </div>
        </div>
      ) : null}

      <ul className="divide-y px-5 sm:px-6" style={{ borderColor: "var(--border)" }}>
        {items.map((item) => (
          <li
            key={item.id}
            className="flex items-start gap-3.5 py-4"
            style={{ borderColor: "var(--border)" }}
          >
            <CheckIcon complete={item.complete} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <p className="text-[14.5px] font-medium" style={{ color: "var(--ink)" }}>
                  {item.title}
                </p>
                <span
                  className="text-[11.5px] font-medium uppercase tracking-[0.04em]"
                  style={{
                    color: item.complete ? "var(--success-fg)" : "var(--text-tertiary)",
                  }}
                >
                  {item.complete ? "Complete" : "Pending"}
                </span>
              </div>
              <p
                className="mt-0.5 text-[13.5px] leading-relaxed"
                style={{ color: "var(--text-secondary)" }}
              >
                {item.detail}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
