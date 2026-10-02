import Link from "next/link";
import { runWhitbyDraftsNow } from "@/whitbyos/work-plans/actions";
import { MakeAStart } from "@/whitbyos/work-plans/[id]/components/MakeAStart";
import type { PlanWorkstream } from "@/whitbyos/lib/work-plans";

/**
 * What Whitby got on with, in one place.
 *
 * The drafts themselves live on the tasks they belong to, which is where they
 * are used. This is the other half of the same requirement: an assistant that
 * does work and never says what it did is an assistant nobody trusts, and
 * until now every autonomous thing in this product happened silently. The
 * briefing written onto a hand-typed task, the links attached by a re-lookup,
 * the mail summarised at six in the morning: all of it just appeared.
 *
 * So it is a card on the rail, near the top, where somebody coming back to a
 * plan reads it before the work. It says the number, then what each one was,
 * then gets out of the way.
 */

type Row = { taskId: string; title: string; summary: string };

/** Every task on the plan carrying a draft nobody has dismissed. */
export function whitbyDrafts(streams: PlanWorkstream[]): Row[] {
  const rows: Row[] = [];

  for (const stream of streams) {
    for (const task of stream.tasks) {
      if (!task.whitbyDraft) continue;
      rows.push({ taskId: task.id, title: task.title, summary: task.whitbyDraft.summary });
    }
  }

  return rows;
}

/**
 * Tasks Whitby said it could do and has not had a go at yet.
 *
 * Every plan adopted before migration 101 is full of these, and so is any plan
 * that gained an `auto` task afterwards. Counted separately from the drafts so
 * the card can offer the work rather than pretend it was already done.
 */
export function whitbyCanStart(streams: PlanWorkstream[]): number {
  let count = 0;

  for (const stream of streams) {
    for (const task of stream.tasks) {
      if (task.kind !== "auto") continue;
      if (task.whitbyDraftedAlready) continue;
      if (String(task.status).toLowerCase() === "complete") continue;
      count += 1;
    }
  }

  return count;
}

export function WhitbyDidThis({
  rows,
  canStart,
  planId,
  basePath,
}: {
  rows: Row[];
  /** How many `auto` tasks are still untouched. */
  canStart: number;
  planId: string;
  /** `/whitbyos/work-plans/<id>`, so each row can link to its task. */
  basePath: string;
}) {
  /* Nothing done and nothing to do: no card. A plan of calls and meetings has
     no share for Whitby, and an empty panel saying so is furniture. */
  if (rows.length === 0 && canStart === 0) return null;

  return (
    <section
      className="overflow-hidden rounded-card border"
      style={{
        borderColor: "color-mix(in srgb, var(--accent) 26%, var(--chrome-line))",
        background: "var(--surface)",
      }}
    >
      <header
        className="flex items-center justify-between gap-3 border-b px-4 py-2.5"
        style={{
          borderColor: "color-mix(in srgb, var(--accent) 16%, var(--chrome-line))",
          background: "var(--accent-tint)",
        }}
      >
        <span
          className="text-[11px] font-semibold uppercase tracking-[0.14em]"
          style={{ color: "var(--accent)" }}
        >
          {/* The heading is the claim, so it only says work was done where
              work was done. On a plan adopted before this existed the card is
              an offer, and calling that "Whitby did this" would be the panel
              lying in its first two words. */}
          {rows.length > 0 ? "Whitby did this" : "Whitby's share"}
        </span>
        {rows.length > 0 ? (
          <span
            className="shrink-0 rounded-full px-2 py-[2px] text-[11.5px] font-semibold tabular-nums"
            style={{ background: "var(--accent)", color: "#fff" }}
          >
            {rows.length}
          </span>
        ) : null}
      </header>

      {/*
        * A line and a count, not the list.
        *
        * This card carried three summaries, a fold and a paragraph, which on
        * a plan with five drafts is most of the rail. The client's own list
        * made the same mistake and was given a screen; so is this.
        */}
      {rows.length > 0 ? (
        <Link
          href={`${basePath}/drafts`}
          className="group flex items-center gap-3 border-b px-4 py-3 no-underline transition-colors hover:bg-[var(--surface-soft)]"
          style={{ borderColor: "var(--chrome-line)", color: "var(--ink)" }}
        >
          <span className="min-w-0 flex-1 text-[12.5px] leading-[1.45]">
            {rows.length === 1
              ? "One first pass, ready to read"
              : `${rows.length} first passes, ready to read`}
          </span>
          <span
            aria-hidden
            className="shrink-0 text-[13px] transition-transform group-hover:translate-x-0.5"
            style={{ color: "var(--text-disabled)" }}
          >
            →
          </span>
        </Link>
      ) : null}

      {/*
        * The offer, for work Whitby has not had a go at.
        *
        * A plan adopted before this existed has every one of its `auto` tasks
        * sitting here, and a plan that gains one later has that. Pressed
        * rather than scheduled: it spends the workspace's credits, the same
        * reason the plan's own research is a button.
        */}
      {canStart > 0 ? (
        <form
          action={runWhitbyDraftsNow}
          className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-t px-4 py-3"
          style={{ borderColor: "var(--chrome-line)" }}
        >
          <input type="hidden" name="plan_id" value={planId} />
          <MakeAStart canStart={canStart} more={rows.length > 0} />
        </form>
      ) : null}

      {/* The paragraph that stood here is on the screen this card leads to,
          which is where there is room to read it. A card on a rail says how
          many and gets out of the way. */}
    </section>
  );
}
