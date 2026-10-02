import Link from "next/link";
import { SectionTitle } from "@/whitbyos/components/EmptyNote";
import type { WorkCounts } from "@/whitbyos/lib/client-sections";

/**
 * SRS §5.3.3's Work section — everything the Client's work touches beyond the
 * Requests and Documents tabs.
 *
 * Counts are real, and each opens the screen it counts — Tasks, Forms,
 * Messages, Updates and Calendar all exist now.
 *
 * They open unfiltered rather than scoped to this client. None of those screens
 * takes a client filter yet, and a link that silently showed everything while
 * looking like it showed one client's would be worse than one that plainly goes
 * to the whole list.
 */
const ITEMS: {
  key: keyof WorkCounts;
  label: string;
  href: string;
  note: string;
}[] = [
  { key: "tasks", label: "Tasks", href: "/whitbyos/tasks", note: "Across this client's requests" },
  { key: "forms", label: "Forms", href: "/whitbyos/forms", note: "Submissions from this client" },
  { key: "messages", label: "Messages", href: "/whitbyos/messages", note: "Threads linked to this client" },
  { key: "updates", label: "Updates", href: "/whitbyos/updates", note: "Progress and plans updates" },
  { key: "calendar", label: "Calendar", href: "/whitbyos/calendar", note: "Events linked to this client" },
];

export function WorkSection({
  counts,
  total,
}: {
  counts: WorkCounts;
  total?: number;
}) {
  const sum =
    total ??
    counts.tasks + counts.forms + counts.messages + counts.updates + counts.calendar;
  const max = Math.max(...ITEMS.map((item) => counts[item.key]), 1);

  return (
    <>
      <div className="mb-3 flex items-end justify-between gap-3">
        <SectionTitle>Work</SectionTitle>
        <span className="mb-1 text-[12px]" style={{ color: "var(--text-quiet)" }}>
          {sum} linked item{sum === 1 ? "" : "s"}
        </span>
      </div>

      <div
        className="overflow-hidden rounded-[12px] border"
        style={{
          borderColor: "color-mix(in srgb, var(--chrome-line) 85%, #c5ced8)",
          background: "var(--surface)",
          boxShadow: "0 1px 2px rgba(31,72,125,.04)",
        }}
      >
        {ITEMS.map((item) => {
          const value = counts[item.key];
          const width = sum === 0 ? 0 : (value / max) * 100;
          return (
            <Link
              key={item.key}
              href={item.href}
              className="grid grid-cols-[5.5rem_minmax(0,1fr)_2.5rem] items-center gap-3 border-b px-4 py-3.5 no-underline last:border-b-0 hover:bg-[var(--surface-soft)]"
              style={{ borderColor: "var(--chrome-line)", color: "var(--ink)" }}
            >
              <span className="min-w-0">
                <span className="block text-[13.5px] font-medium">{item.label}</span>
                <span className="block truncate text-[11px]" style={{ color: "var(--text-quiet)" }}>
                  {item.note}
                </span>
              </span>
              <span
                className="h-2.5 overflow-hidden rounded-full"
                style={{ background: "var(--surface-soft)" }}
              >
                <span
                  className="block h-full rounded-full"
                  style={{
                    width: `${width}%`,
                    background: "var(--accent)",
                    opacity: value === 0 ? 0 : 0.45 + (value / max) * 0.55,
                    minWidth: value > 0 ? 6 : 0,
                  }}
                />
              </span>
              <span className="text-right text-[15px] font-bold tabular-nums tracking-[-0.3px]">
                {value}
              </span>
            </Link>
          );
        })}
      </div>

      <p className="mt-3 text-[12.5px]" style={{ color: "var(--text-tertiary)" }}>
        Counted across this client&apos;s requests. Requests and Documents have
        their own tabs above.
      </p>
    </>
  );
}
