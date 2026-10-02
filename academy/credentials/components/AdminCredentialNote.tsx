/** Admin note — chip for progress alerts; caption under the certificate. */
export function AdminCredentialNote({
  title = "Note from Academy Admin",
  tone = "success",
  variant = "chip",
  children,
}: {
  title?: string;
  tone?: "success" | "warning";
  variant?: "chip" | "caption";
  children: string;
}) {
  const note = children.trim();
  if (!note) return null;

  const isSuccess = tone === "success";

  if (variant === "caption") {
    return (
      <aside
        className="flex w-full items-start gap-3 rounded-[10px] px-4 py-3 text-left"
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          boxShadow: "0 1px 2px rgba(15,15,15,0.04)",
        }}
      >
        <span
          className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
          style={{
            background: "var(--module-academy-bg)",
            color: "var(--module-academy-fg)",
          }}
          aria-hidden
        >
          <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
            <path
              d="M3.5 4.2h7M3.5 7h5.5M3.5 9.8h4"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </span>
        <div className="min-w-0 flex-1">
          <p
            className="text-[11px] font-semibold uppercase tracking-[0.07em]"
            style={{ color: "var(--text-tertiary)" }}
          >
            {title}
          </p>
          <p className="mt-1 text-[14px] leading-[1.45] text-pretty" style={{ color: "var(--ink)" }}>
            {note}
          </p>
        </div>
      </aside>
    );
  }

  return (
    <aside
      className="inline-flex w-fit max-w-[min(100%,28rem)] items-start gap-2.5 rounded-[9px] px-3 py-2 text-left"
      style={{
        background: isSuccess
          ? "color-mix(in srgb, var(--success-bg) 55%, var(--surface))"
          : "var(--warning-bg)",
        border: `1px solid ${isSuccess ? "color-mix(in srgb, var(--success-fg) 18%, var(--border))" : "var(--warning-border)"}`,
      }}
    >
      <span
        className="mt-px inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
        style={{
          background: isSuccess ? "var(--success-bg)" : "color-mix(in srgb, var(--warning-border) 45%, white)",
          color: isSuccess ? "var(--success-fg)" : "var(--warning-fg)",
        }}
        aria-hidden
      >
        {isSuccess ? (
          <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
            <path
              d="M3.5 7.2 5.8 9.4 10.5 4.2"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        ) : (
          <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
            <path
              d="M7 3.2v5.2M7 10.6h.01"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
            />
          </svg>
        )}
      </span>
      <div className="min-w-0">
        <p
          className="text-[10.5px] font-semibold uppercase tracking-[0.06em]"
          style={{ color: isSuccess ? "var(--success-fg)" : "var(--warning-fg)" }}
        >
          {title}
        </p>
        <p className="mt-0.5 text-[13px] leading-[1.35] text-pretty" style={{ color: "var(--ink)" }}>
          {note}
        </p>
      </div>
    </aside>
  );
}
