/** The label and control 17.1's long forms repeat down every section. */
export const AREA =
  "w-full rounded-control border border-line-strong bg-surface px-2.5 py-[9px] text-[13.5px] leading-[1.55] text-ink";

/** A heading with the sentence that says why the section exists. */
export function Section({
  id,
  title,
  note,
  children,
}: {
  id?: string;
  title: string;
  note: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="border-t border-line pt-6 first:border-t-0 first:pt-0">
      <h2 className="text-[15px] font-semibold tracking-[-0.2px]" style={{ margin: 0 }}>
        {title}
      </h2>
      <p
        className="mb-4 mt-1 text-[12.5px] leading-[1.55]"
        style={{ color: "var(--text-tertiary)" }}
      >
        {note}
      </p>
      <div className="flex flex-col gap-4">{children}</div>
    </section>
  );
}
