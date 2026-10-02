import { Button } from "@/base/components/Button";
import { Submit, SubmitPlain } from "@/base/components/Submit";
import { PageHeader } from "@/whitbyos/components/PageHeader";
import { StateMessage } from "@/whitbyos/components/StateMessage";
import { Toast } from "@/whitbyos/components/Toast";
import { Modal } from "@/whitbyos/components/Modal";
import {
  considerationToTask,
  dismissConsideration,
  resolveConsideration,
} from "@/whitbyos/insights/actions";
import {
  CONSIDERATION_TONES,
  CONSIDERATION_TYPES,
  listConsiderations,
  typeLabel,
  typeTone,
} from "@/whitbyos/lib/insights";
import { InsightsList } from "@/whitbyos/insights/components/InsightsList";

const LIST = "/whitbyos/insights";

function one(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Screens 14 and 14.1 — Insights.
 *
 * Considerations are what Whitby noticed about work in flight: something not
 * confirmed, something gone stale, a gap with no fallback, a clash with the
 * calendar. Nothing here writes them — that is the AI layer, which is not wired
 * — so this screen reads what is there and lets a professional act on it.
 */
export default async function InsightsPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const result = await listConsiderations();
  const openId = one(searchParams?.open);
  const q = (one(searchParams?.q) ?? "").trim();
  const error = one(searchParams?.error);

  /* Everything. The search and the kind narrow it in the browser, a
     keystroke at a time, rather than on a round trip — `InsightsList` holds
     both, and holds them over the whole list rather than the drawn part. */
  const all = result.ok ? result.rows : [];
  const kind = (one(searchParams?.type) ?? "").trim();

  const open = result.ok ? (result.rows.find((row) => row.id === openId) ?? null) : null;

  return (
    <div className="px-5 py-6 sm:px-8 sm:py-9 xl:px-12">
      <PageHeader
        title="Insights"
        size={22}
        gap={20}
        subtitle="What Whitby noticed while the work was being drafted: a detail nobody has given, a step with no fallback, two things booked over each other. Review one to act on it, or dismiss it."
      />

      {!result.ok ? (
        <StateMessage
          glyph="!"
          tone="danger"
          title="Something went wrong"
          description="We couldn't load your Insights. Check your connection and try again, if this keeps happening, contact support."
          action={
            <>
              <Button unsized
                href="mailto:support@privateattache.com?subject=Insights%20failed%20to%20load"
                variant="secondary"
                className="px-4 py-[9px]"
              >
                Contact support
              </Button>
              <Button unsized href={LIST} variant="primary" className="px-[18px] py-[9px]">
                Try again
              </Button>
            </>
          }
        />
      ) : (
        <>
          {/* One band with rules between: four readings of one list, not four
              facts. Three of them are kinds of consideration and the first is
              all of them, so they belong to each other. */}
          <div className="mb-6 grid overflow-hidden rounded-[12px] border border-line bg-surface grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
            <Stat
              glyph="◈"
              mark={{ bg: "var(--module-academy-bg)", fg: "var(--module-academy-fg)" }}
              value={result.counts.open}
              label="Open Considerations"
              note={`Across ${result.counts.requests} active Request${result.counts.requests === 1 ? "" : "s"}`}
            />
            <Stat
              glyph="◷"
              mark={{ bg: "var(--warning-bg)", fg: "var(--warning-fg)" }}
              value={result.counts.stale}
              label="Stale Information"
              note="Nothing on a plan has gone unconfirmed long enough to raise one"
              quietAtZero
            />
            <Stat
              glyph="!"
              mark={{ bg: "var(--danger-bg)", fg: "var(--danger-action-fg)" }}
              value={result.counts.risk}
              label="Risk / Backup Gaps"
              note="No contingency identified"
              alert
            />
            <Stat
              glyph="▦"
              mark={{ bg: "var(--success-bg)", fg: "var(--success-fg)" }}
              value={result.counts.calendar}
              label="Calendar Conflicts"
              note="Overlaps a connected event"
              alert
            />
          </div>

          {result.rows.length === 0 ? (
            <StateMessage
              glyph="◈"
              title="Nothing needs a second look"
              description="Whitby raises a consideration when something on live work looks unconfirmed, out of date, or without a fallback. There is nothing open right now."
            />
          ) : (
            <InsightsList
              rows={all}
              typeLabel={CONSIDERATION_TYPES}
              typeTone={CONSIDERATION_TONES}
              initialQuery={q}
              initialKind={kind}
            />
          )}
        </>
      )}

      {open ? (
        <Modal title={typeLabel(open.type)} closeHref={LIST} width={520} dense>
          {/* The kind, in its colour, and where it came from — the two
              things you need before reading the sentence itself. The title
              said the kind in plain black, which made every one of these
              dialogs look the same. */}
          <div className="-mt-3 mb-4 flex flex-wrap items-center gap-2">
            <span
              className="rounded-full px-2 py-[3px] text-[11.5px] font-medium"
              style={{ background: typeTone(open.type).bg, color: typeTone(open.type).fg }}
            >
              {typeLabel(open.type)}
            </span>
            <span className="text-[12.5px]" style={{ color: "var(--text-tertiary)" }}>
              {[open.requestTitle, open.streamName ? `${open.streamName} Workstream` : null]
                .filter(Boolean)
                .join(" · ")}
            </span>
          </div>

          {/* The sentence, on its own ground. It is the whole content of
              this dialog and it was floating between two grey lines. */}
          <p
            className="mb-4 rounded-[10px] px-3.5 py-3 text-[13.5px] leading-[1.7]"
            style={{ background: "var(--surface-soft)", color: "var(--ink)" }}
          >
            {open.body}
          </p>

          {open.sourceReference ? (
            <p className="mb-5 text-[12.5px]" style={{ color: "var(--text-tertiary)" }}>
              From {open.sourceReference}
            </p>
          ) : (
            <div className="mb-5" />
          )}

          {open.taskId ? (
            <p
              className="mb-5 rounded-[10px] px-3 py-2.5 text-[12.5px] leading-[1.5]"
              style={{ background: "var(--success-bg)", color: "var(--success-fg)" }}
            >
              A task has already been added for this. It stays open until that
              task is done.
            </p>
          ) : null}

          <div className="flex items-center justify-between gap-2.5">
            <form action={dismissConsideration}>
              <input type="hidden" name="consideration_id" value={open.id} />
              <SubmitPlain
                className="rounded-control px-2.5 py-[9px] text-[13.5px] font-medium transition-colors hover:bg-[var(--surface-active)]"
                style={{ color: "var(--text-secondary)" }}
              >
                Dismiss
              </SubmitPlain>
            </form>

            <div className="flex gap-2.5">
              {open.taskId ? null : (
                <form action={considerationToTask}>
                  <input type="hidden" name="consideration_id" value={open.id} />
                  <SubmitPlain
                   
                    className="rounded-control border border-line-strong px-4 py-[9px] text-[13.5px] font-medium"
                    style={{ background: "var(--surface)", color: "var(--ink)" }}
                  >
                    Add Task
                  </SubmitPlain>
                </form>
              )}

              <form action={resolveConsideration}>
                <input type="hidden" name="consideration_id" value={open.id} />
                <Submit unsized variant="primary" className="px-[18px] py-[9px] text-[13.5px]">
                  Resolve
                </Submit>
              </form>
            </div>
          </div>
        </Modal>
      ) : null}

      {error ? (
        <Toast tone="danger" title="Something went wrong" detail={error} closeHref={LIST} />
      ) : null}

      {one(searchParams?.tasked) ? (
        <Toast
          title="Task added"
          detail="It is on the Request. This consideration stays open until the task is done."
          closeHref={LIST}
        />
      ) : null}

      {one(searchParams?.resolved) ? (
        <Toast title="Resolved" detail="It is off your list." closeHref={LIST} />
      ) : null}

      {one(searchParams?.dismissed) ? (
        <Toast title="Dismissed" detail="Whitby will not raise it again." closeHref={LIST} />
      ) : null}
    </div>
  );
}

/** 14's four cards. */
/**
 * One reading of the list below, as a cell in a band.
 *
 * `alert` puts the figure in red — but only when it is not nil, because a red
 * 0 is a false alarm and a screen that raises one stops being read. And a
 * kind of consideration nobody has raised says why in its own line rather than
 * leaving somebody to wonder what it was counting.
 */
function Stat({
  glyph,
  mark,
  value,
  label,
  note,
  alert,
  quietAtZero,
}: {
  glyph: string;
  mark: { bg: string; fg: string };
  value: number;
  label: string;
  note: string;
  alert?: boolean;
  /** Its note only means anything when there is nothing to count. */
  quietAtZero?: boolean;
}) {
  const loud = Boolean(alert) && value > 0;

  /*
   * Nothing to report is good news, and it was drawn as a failure.
   *
   * A nought sat in full black beside its coloured tile and read as a
   * broken counter. A tile with nothing in it steps back — the mark loses
   * its tint, the figure goes quiet — so the eye lands on the ones that
   * have something in them, which is the whole job of a row of counts.
   */
  const empty = value === 0;

  return (
    <div
      className="flex flex-col gap-1.5 border-l border-line px-4 py-4 transition-colors first:border-l-0"
      style={loud ? { background: "color-mix(in srgb, var(--danger-bg) 42%, transparent)" } : undefined}
    >
      <div className="flex items-center gap-2">
        <span
          aria-hidden
          className="flex h-[24px] w-[24px] shrink-0 items-center justify-center rounded-[8px] text-[11px]"
          style={
            empty
              ? { background: "var(--surface-active)", color: "var(--text-quiet)" }
              : { background: mark.bg, color: mark.fg }
          }
        >
          {glyph}
        </span>
        <span
          className="text-[22px] font-bold leading-none tabular-nums"
          style={{
            color: loud
              ? "var(--danger-text)"
              : empty
                ? "var(--text-quiet)"
                : "var(--ink)",
          }}
        >
          {value}
        </span>
      </div>
      <div
        className="text-[12px] font-medium"
        style={empty ? { color: "var(--text-secondary)" } : undefined}
      >
        {label}
      </div>
      <div className="text-[11px] leading-[1.45]" style={{ color: "var(--text-quiet)" }}>
        {quietAtZero && value > 0 ? "Raised on live work" : note}
      </div>
    </div>
  );
}
