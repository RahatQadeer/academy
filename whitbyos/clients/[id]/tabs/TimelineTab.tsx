import { Button } from "@/base/components/Button";
import { EmptyNote, SectionTitle } from "@/whitbyos/components/EmptyNote";
import { ShowMore } from "@/whitbyos/components/ShowMore";
import { relativeTime, statusLabel } from "@/whitbyos/lib/format";
import type { TimelineEntry } from "@/whitbyos/lib/client-detail";
import type { HistoryEntry } from "@/whitbyos/lib/client-sections";

function softBorder() {
  return "color-mix(in srgb, var(--chrome-line) 85%, #c5ced8)";
}

/**
 * SRS §5.3.3 section 6 — History: the Timeline, Notes, Communications and other
 * meaningful prior activity.
 *
 * Timeline is Request-contextual (§6.14.4 — there is no global client
 * timeline), so this stitches together the events of the client's requests, and
 * shows Notes and Communications alongside them.
 */
export function TimelineTab({
  entries,
  history,
  exportHref,
}: {
  entries: TimelineEntry[];
  history: HistoryEntry[];
  /** Opens 2.1.6. The export is offered even when there is nothing yet — an
   *  empty record is still a record someone may need to produce. */
  exportHref: string;
}) {
  const empty = entries.length === 0 && history.length === 0;

  const header = (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <span className="min-w-0">
        <span className="block text-[15px] font-semibold tracking-[-0.15px]">History</span>
        <span className="mt-0.5 block text-[12.5px]" style={{ color: "var(--text-tertiary)" }}>
          Everything that has happened on this client&apos;s work, newest first.
        </span>
      </span>
      <Button
        unsized
        href={exportHref}
        variant="secondary"
        className="shrink-0 whitespace-nowrap px-3.5 py-[7px] text-[12.5px]"
      >
        ↓ Export as PDF
      </Button>
    </div>
  );

  if (empty) {
    return (
      <>
        {header}
        <div
          className="rounded-[12px] border px-6 py-8"
          style={{
            borderColor: softBorder(),
            background: "var(--surface)",
          }}
        >
          <EmptyNote>
            No history yet. Timeline events, notes and logged communications appear
            here as work happens on this client&apos;s requests.
          </EmptyNote>
        </div>
      </>
    );
  }

  return (
    <>
      {header}
      {entries.length > 0 ? (
        <div className="mb-6">
          <SectionTitle>Timeline</SectionTitle>
          <div
            className="overflow-hidden rounded-[12px] border px-4 py-1"
            style={{
              borderColor: softBorder(),
              background: "var(--surface)",
              boxShadow: "0 1px 2px rgba(31,72,125,.04)",
            }}
          >
            <ShowMore step={7}>
              {entries.map((entry) => (
                <Line
                  key={entry.id}
                  kind="event"
                  body={entry.description}
                  detail={entry.request_title}
                  at={entry.created_at}
                />
              ))}
            </ShowMore>
          </div>
        </div>
      ) : null}

      {history.length > 0 ? (
        <div>
          <SectionTitle>Notes and Communications</SectionTitle>
          <div
            className="overflow-hidden rounded-[12px] border px-4 py-1"
            style={{
              borderColor: softBorder(),
              background: "var(--surface)",
              boxShadow: "0 1px 2px rgba(31,72,125,.04)",
            }}
          >
            <ShowMore step={7}>
              {history.map((entry) => (
                <Line
                  key={entry.id}
                  kind={entry.kind === "note" ? "note" : "call"}
                  body={entry.body}
                  detail={entry.detail ? statusLabel(entry.detail) : null}
                  at={entry.created_at}
                />
              ))}
            </ShowMore>
          </div>
        </div>
      ) : null}
    </>
  );
}

function Line({
  kind,
  body,
  detail,
  at,
}: {
  kind: "event" | "note" | "call";
  body: string;
  detail: string | null;
  at: string;
}) {
  const mark =
    kind === "note"
      ? { glyph: "✎", bg: "var(--avatar-tan-bg)", fg: "var(--avatar-tan-fg)" }
      : kind === "call"
        ? { glyph: "☎", bg: "var(--accent-tint)", fg: "var(--accent)" }
        : { glyph: "●", bg: "var(--accent-tint)", fg: "var(--accent)" };

  return (
    <div className="relative flex items-start gap-3 py-3.5 pl-[28px]">
      <span
        aria-hidden
        className="absolute bottom-0 left-[11px] top-0 w-px"
        style={{ background: "var(--chrome-line)" }}
      />
      <span
        aria-hidden
        className="absolute left-[2px] top-[16px] flex h-[18px] w-[18px] items-center justify-center rounded-full text-[9px] font-bold"
        style={{
          background: mark.bg,
          color: mark.fg,
          boxShadow: "0 0 0 3px var(--surface)",
        }}
      >
        {mark.glyph}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[13.5px] leading-[1.45]" style={{ color: "var(--ink)" }}>
          {body}
        </span>
        {detail ? (
          <span className="mt-0.5 block text-[12px]" style={{ color: "var(--text-tertiary)" }}>
            {detail}
          </span>
        ) : null}
      </span>
      <span className="shrink-0 text-[12px]" style={{ color: "var(--text-quiet)" }}>
        {relativeTime(at)}
      </span>
    </div>
  );
}
