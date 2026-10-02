import { SubmitPlain } from "@/base/components/Submit";
import { dismissWhitbyDraft } from "@/whitbyos/work-plans/actions";
import { shortDate } from "@/whitbyos/lib/format";
import type { WhitbyDraft } from "@/whitbyos/lib/work-plans";

/**
 * What Whitby did for a task, on the task.
 *
 * Whitby has always classified tasks it could do itself as `auto` and then
 * handed them to a person anyway. This is the result of it actually doing one:
 * the material, not a plan for the material, written when the professional
 * adopted the plan.
 *
 * It sits above the steps rather than below them. Somebody opening a task is
 * asking how to finish it, and the honest answer on these tasks is that a
 * first pass already exists and the job is to check it.
 *
 * Drawn in the accent, the way everything of Whitby's is, and never in a tone
 * that reads as done: the task is still open, and the card says whose turn it
 * is at the bottom rather than leaving it to be assumed.
 */
export function WhitbyDraftCard({
  draft,
  draftedAt,
  planId,
  taskId,
  returnTo,
}: {
  draft: WhitbyDraft;
  draftedAt: string | null;
  planId: string;
  taskId: string;
  /** Where dismissing comes back to. The task, usually. */
  returnTo: string;
}) {
  return (
    <section
      className="overflow-hidden rounded-card border"
      style={{
        borderColor: "color-mix(in srgb, var(--accent) 28%, var(--chrome-line))",
        background: "var(--surface)",
        boxShadow: "0 1px 2px rgba(31,72,125,.05)",
      }}
    >
      <header
        className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b px-4 py-3"
        style={{
          borderColor: "color-mix(in srgb, var(--accent) 18%, var(--chrome-line))",
          background: "var(--accent-tint)",
        }}
      >
        <div className="min-w-0">
          <div
            className="text-[11px] font-semibold uppercase tracking-[0.14em]"
            style={{ color: "var(--accent)" }}
          >
            Whitby did this
          </div>
          <p className="mt-1 text-[13.5px] leading-[1.5]" style={{ margin: 0 }}>
            {draft.summary}
          </p>
        </div>

        {/* Reversible has to mean a button. Plain rather than a bin: this is
            one of several things on the page and the destructive icon next to
            it deletes a client requirement. */}
        <form action={dismissWhitbyDraft} className="shrink-0">
          <input type="hidden" name="plan_id" value={planId} />
          <input type="hidden" name="task_id" value={taskId} />
          <input type="hidden" name="return_to" value={returnTo} />
          <SubmitPlain
            className="cursor-pointer rounded-control border px-2.5 py-[5px] text-[12.5px] font-medium"
            style={{
              borderColor: "color-mix(in srgb, var(--accent) 30%, transparent)",
              background: "var(--surface)",
              color: "var(--text-secondary)",
            }}
          >
            Dismiss
          </SubmitPlain>
        </form>
      </header>

      {/*
        * The material folds; the summary and the open points do not.
        *
        * A real one runs to several screens: thirteen fields to record, a
        * comparison template, a method. That is the point of it and also the
        * problem, because it sits above the steps on a task page somebody
        * opened to do something else.
        *
        * Shut to begin with. The header already says what was written, and
        * the open points below say what is still missing, which between them
        * are the two things worth knowing without reading it. `<details>` so
        * it needs no script and prints open.
        */}
      <details className="group">
        <summary
          className="flex cursor-pointer list-none items-center gap-2 border-b px-4 py-2.5 text-[12.5px] font-medium [&::-webkit-details-marker]:hidden"
          style={{ borderColor: "var(--chrome-line)", color: "var(--accent)" }}
        >
          <span
            aria-hidden
            className="text-[9px] transition-transform group-open:rotate-90"
          >
            ▶
          </span>
          <span className="group-open:hidden">
            Read the draft
            {draft.sections.length > 1 ? `, ${draft.sections.length} parts` : ""}
          </span>
          <span className="hidden group-open:inline">Hide the draft</span>
        </summary>

      <div className="flex flex-col gap-4 px-4 py-4">
        {draft.sections.map((part, index) => (
          <div key={index}>
            <h3 className="mb-1 text-[13px] font-semibold leading-snug">{part.heading}</h3>
            {/* `whitespace-pre-wrap` because a drafted checklist is a list.
                Collapsing it turns twelve numbered lines into one paragraph
                of fragments, which is the draft made unreadable to save a
                CSS property. */}
            <p
              className="whitespace-pre-wrap text-[13.5px] leading-[1.6]"
              style={{ margin: 0, color: "var(--text-secondary)" }}
            >
              {part.body}
            </p>
          </div>
        ))}

      </div>
      </details>

      <div className="flex flex-col gap-4 px-4 py-4">
        {draft.openPoints.length > 0 ? (
          /* The most important part of the card. A draft that quietly guessed
             would look finished; these are the things it refused to guess, and
             they are why the task is still open. */
          <div
            className="rounded-[10px] border px-3.5 py-3"
            style={{
              borderColor: "var(--warning-line, var(--chrome-line))",
              background: "var(--warning-bg, var(--surface-soft))",
            }}
          >
            <div className="mb-1.5 text-[12px] font-semibold">
              Whitby could not settle {draft.openPoints.length === 1 ? "this" : "these"}
            </div>
            <ul
              className="m-0 flex list-disc flex-col gap-1 pl-4 text-[13px] leading-[1.55]"
              style={{ color: "var(--text-secondary)" }}
            >
              {draft.openPoints.map((point, index) => (
                <li key={index}>{point}</li>
              ))}
            </ul>
          </div>
        ) : null}

        <p
          className="text-[12px] leading-[1.5]"
          style={{ margin: 0, color: "var(--text-faint)" }}
        >
          A first pass, for the firm only. Nothing here has been sent or filed, and the task
          stays open until you close it
          {draftedAt ? ` · drafted ${shortDate(draftedAt)}` : ""}.
        </p>
      </div>
    </section>
  );
}
