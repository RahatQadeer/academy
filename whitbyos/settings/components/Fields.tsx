/** The label and control 17.x repeats down every tab. */
export const LABEL = "mb-1.5 block text-[12.5px] font-medium";

export const CONTROL =
  "w-full rounded-control border border-line-strong bg-surface px-2.5 py-[9px] text-[13.5px] text-ink";

export function Field({
  label,
  htmlFor,
  className,
  children,
}: {
  label: string;
  htmlFor?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <label htmlFor={htmlFor} className={LABEL} style={{ color: "var(--text-secondary)" }}>
        {label}
      </label>
      {children}
    </div>
  );
}

/** A read-only row, as 17.4 draws its whole table. */
export function DetailRow({
  label,
  children,
  last,
}: {
  label: string;
  children: React.ReactNode;
  last?: boolean;
}) {
  return (
    <div
      className="flex items-center justify-between gap-4 px-5 py-3.5"
      style={{ borderBottom: last ? undefined : "1px solid var(--canvas)" }}
    >
      <span className="text-[12.5px] font-medium" style={{ color: "var(--text-secondary)" }}>
        {label}
      </span>
      {children}
    </div>
  );
}
