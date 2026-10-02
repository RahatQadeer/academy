"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { refineWorkplan } from "@/whitbyos/requests/actions";
import type { RefineTurn } from "@/whitbyos/lib/workplan";
import type { AskPendingAction } from "@/whitbyos/lib/ask";

/**
 * What a refinement is doing, in the order it happens.
 *
 * A refinement is the whole plan rewritten from the instruction, which is a
 * minute or so of model call and three or four writes after it. These are
 * those, worded as what is being done rather than as what has finished.
 */
const WORKING = [
  "Reading the plan",
  "Working out what to change",
  "Rewriting the Work Streams",
  "Redating the tasks",
  "Saving the new version",
];

/** And when it is a question, because then nothing is being rewritten. */
const LOOKING = ["Reading the plan", "Looking across the workspace", "Writing the answer"];

/** The same test the server makes, so the wait describes what is happening. */
const ASKING = /^(what|where|when|why|who|whose|which|how|is|are|was|were|do|does|did|can|could|should|would|will|shall|has|have|any)\b/i;

/**
 * Ask Whitby, opened out.
 *
 * It was a 280px box on the rail: a heading, one line of placeholder, and a
 * single-line input — the smallest thing on a screen whose whole point is that
 * you can change the plan by describing the change. This is a panel, and the
 * room it takes is the room the feature is worth.
 *
 * A client component because one piece of state is shared across all of it:
 * the draft. Pressing a suggestion writes into the box rather than sending it,
 * so the wording can be adjusted before it goes — these are openings, not
 * commands.
 */
export function AskWhitbyPanel({
  requestId,
  planId,
  planName,
  turns,
  suggestions,
  returnTo,
  closeHref,
  freshHref,
  error,
  onClose,
  sheet = false,
}: {
  requestId: string;
  /** The plan this panel belongs to, so a create lands on it. */
  planId: string;
  planName: string;
  turns: RefineTurn[];
  /** Written from this plan, not from a list of examples. */
  suggestions: string[];
  returnTo: string;
  closeHref: string;
  /** The panel with the history put away. */
  freshHref: string;
  error?: string;
  /** Closing does not need the server; it is the same page without the box. */
  onClose: () => void;
  /**
   * Opened as the Playbook-style white sheet from the header button.
   * Fills the sheet rather than drawing its own card on the rail.
   */
  sheet?: boolean;
}) {
  // `closeHref` is where the server sends somebody back to after a refine;
  // closing by hand is the button above and does not reload anything.
  void closeHref;

  const router = useRouter();

  const [draft, setDraft] = useState("");
  const [asking, setAsking] = useState<string | null>(null);
  const [said, setSaid] = useState<{ asked: string; answer: string }[]>([]);
  /**
   * A create Whitby has started and not finished.
   *
   * A ref rather than state: nothing on screen depends on it, and it must be
   * readable by the submit handler on the very next keystroke without
   * waiting for a render.
   */
  const pending = useRef<AskPendingAction | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  /** The sentence that produced `failed`, so it stays on screen with the reply. */
  const [failedAsk, setFailedAsk] = useState<string | null>(null);
  /** Whether that message is advice rather than a fault — see `RefineResult`. */
  const [hinted, setHinted] = useState(false);

  /**
   * The exchange happens here, not on a new page.
   *
   * The action used to end in a redirect, so sending a question reloaded the
   * plan: the question and the working dots went with it, and the answer
   * appeared only after a full page load. A conversation cannot feel like one
   * if every turn is a navigation.
   *
   * `inline=1` makes the action answer instead. The question goes up
   * immediately, the dots run while the model works, the reply lands under it,
   * and `router.refresh()` updates the Work Streams behind the panel without
   * the page going anywhere.
   */
  async function send(formData: FormData) {
    const asked = String(formData.get("instruction") ?? "").trim();
    if (!asked) return;

    /* Already done on the submit event below, and harmless twice — this is
       the path a form submitted any other way still takes. */
    setAsking(asked);
    setFailed(null);
    setFailedAsk(null);
    setHinted(false);

    formData.set("inline", "1");
    /* Which plan is on the screen behind this panel. */
    formData.set("on_plan_id", planId);

    /* A create Whitby is still filling in. It has nowhere on the server to
       live from this panel, so it rides along with the next answer. */
    if (pending.current) formData.set("pending", JSON.stringify(pending.current));

    /*
     * Nothing is allowed to end in silence.
     *
     * Anything thrown here — a refusal from the server, a dropped connection,
     * a read-only workspace — used to leave the dots running forever, with
     * the box disabled behind them and no way to tell whether the plan had
     * been rewritten or nothing had happened at all. Whatever happens, the
     * panel stops working and says something.
     */
    try {
      const result = await refineWorkplan(formData);

      if (!result || !result.ok) {
        const reply = result?.error ?? "Whitby could not make that change.";
        /* Advice is still a turn: the sentence they typed has to stay on
           screen, the way a question does. Returning it as `failed` drew
           only Whitby's side, so "ok" vanished and the hint sat there
           alone. */
        if (result?.hint) {
          setSaid((all) => [...all, { asked, answer: reply }]);
          return;
        }
        setFailedAsk(asked);
        setFailed(reply);
        setHinted(false);
        return;
      }

      pending.current = result.pending ?? null;
      setSaid((all) => [...all, { asked, answer: result.summary ?? "Done." }]);
      /* A question changed nothing, so there is nothing behind the panel to
         re-read. */
      if (!result.answered) router.refresh();
    } catch (error) {
      setHinted(false);
      setFailedAsk(asked);
      setFailed(
        error instanceof Error && error.message
          ? `Whitby could not make that change: ${error.message}`
          : "Whitby could not make that change. Nothing in the plan was touched.",
      );
    } finally {
      setAsking(null);
    }
  }

  const recent = turns.slice(-6);

  /*
   * What the wait is doing, while it does it.
   *
   * Three dots for ninety seconds is indistinguishable from a page that has
   * stopped. Nothing out here can see inside the model call, so nothing here
   * claims to: the line moves at the pace these stages usually take and says
   * what is being done, and the seconds beside it are real, which is what
   * answers "is this stuck?" without anybody having to guess.
   */
  const [stage, setStage] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const transcript = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const box = transcript.current;
    if (!box) return;
    /* Only once there is something to follow — scrolling an empty chat
       on open just jumps the welcome away for no reason. */
    if (!asking && said.length === 0 && !failed) return;
    box.scrollTop = box.scrollHeight;
  }, [asking, said.length, failed]);

  useEffect(() => {
    if (!asking) {
      setStage(0);
      setElapsed(0);
      return;
    }

    const steps = ASKING.test(asking) || asking.endsWith("?") ? LOOKING : WORKING;

    const stages = setInterval(
      () => setStage((at) => (at < steps.length - 1 ? at + 1 : at)),
      5_000,
    );
    const clock = setInterval(() => setElapsed((seconds) => seconds + 1), 1_000);

    return () => {
      clearInterval(stages);
      clearInterval(clock);
    };
  }, [asking]);

  const empty = recent.length === 0 && said.length === 0 && !asking && !failed && !error;
  const talking = !empty;

  function onSubmitForm(event: FormEvent<HTMLFormElement>) {
    const asked = new FormData(event.currentTarget).get("instruction");
    const saidText = String(asked ?? "").trim();
    if (!saidText) return;

    setAsking(saidText);
    setFailed(null);
    setFailedAsk(null);
    setHinted(false);
    setDraft("");
  }

  const composer = (
    <form
      action={send}
      onSubmit={onSubmitForm}
      className={
        sheet
          ? "pa-ask-box flex items-center gap-2.5 rounded-[14px] border bg-white px-4 py-3"
          : undefined
      }
    >
      <input type="hidden" name="request_id" value={requestId} />
      <input type="hidden" name="return_to" value={returnTo} />
      {sheet ? (
        <>
          <input
            name="instruction"
            required
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            disabled={Boolean(asking)}
            placeholder={
              /* Short enough to finish inside a 380px rail — the longer
                 version was cut off mid-word, which reads as a bug. */
              asking ? "Whitby is working on it…" : "Ask for a change, or something new…"
            }
            aria-label="Ask for a change to this Work Plan, or ask Whitby to make something"
            className="min-w-0 flex-1 border-0 bg-transparent py-1 text-[13.5px] outline-none disabled:cursor-not-allowed"
            style={{ color: "#17181a" }}
          />
          <button
            type="submit"
            disabled={Boolean(asking) || draft.trim().length === 0}
            aria-label="Send"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white disabled:cursor-default"
            style={{
              background:
                asking || draft.trim().length === 0 ? "rgba(35,131,226,.4)" : "#2383e2",
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M12 19V5M6 11l6-6 6 6" />
            </svg>
          </button>
        </>
      ) : (
        <div className="pa-whitby-box flex items-end gap-2 rounded-[12px] border px-3 py-2.5">
          <textarea
            name="instruction"
            required
            rows={2}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== "Enter" || event.shiftKey) return;
              event.preventDefault();
              if (asking || draft.trim().length === 0) return;
              event.currentTarget.form?.requestSubmit();
            }}
            disabled={Boolean(asking)}
            placeholder={asking ? "Whitby is working on it…" : "Tell Whitby what to change"}
            aria-label="Tell Whitby what to change"
            className="min-w-0 flex-1 resize-none border-none bg-transparent text-[13px] leading-[1.5] outline-none placeholder:text-[color:var(--text-quiet)] disabled:cursor-not-allowed"
          />
          <button
            type="submit"
            disabled={Boolean(asking) || draft.trim().length === 0}
            aria-label="Send to Whitby"
            className="pa-whitby-send mb-px flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full text-[14px] text-white disabled:opacity-30"
            style={{ background: "var(--accent)" }}
          >
            ↑
          </button>
        </div>
      )}
    </form>
  );

  const transcriptBody = (
    <>
      {recent.map((turn) => (
        <Exchange
          key={turn.id}
          asked={turn.instruction}
          reply={
            turn.changedStreams.length > 0
              ? `Done, ${turn.changedStreams.join(", ")} updated. The plan now has ${turn.stepCount} step${turn.stepCount === 1 ? "" : "s"}.`
              : `Done, the plan now has ${turn.stepCount} step${turn.stepCount === 1 ? "" : "s"}.`
          }
          sheet={sheet}
        />
      ))}

      {said.map((turn, index) => (
        <Exchange
          key={`said-${index}`}
          asked={turn.asked}
          reply={index === said.length - 1 ? undefined : turn.answer}
          typed={index === said.length - 1 ? turn.answer : undefined}
          sheet={sheet}
        />
      ))}

      {asking ? (
        <Exchange
          asked={asking}
          waiting={
            <>
              {(ASKING.test(asking) || asking.endsWith("?") ? LOOKING : WORKING)[stage]}
              <span style={{ color: sheet ? "#5c5e66" : "var(--text-tertiary)" }}>
                {" "}
                {elapsed < 60 ? `${elapsed}s` : `${Math.floor(elapsed / 60)}m ${elapsed % 60}s`}
              </span>
            </>
          }
          sheet={sheet}
        />
      ) : null}

      {failed || error ? (
        <Exchange
          asked={failedAsk ?? undefined}
          reply={failed ?? error ?? undefined}
          danger={!hinted}
          sheet={sheet}
        />
      ) : null}
    </>
  );

  if (sheet) {
    return (
      <aside
        className="flex h-full min-h-0 w-full flex-col overflow-hidden bg-transparent"
        aria-label="Ask Whitby"
      >
        {/*
          * The header says what this is and which plan it is on.
          *
          * It carried a filled blue tile with the mark inside it, the same
          * square that was taken off the button that opens this panel: a
          * solid block of the accent is how a chrome row announces itself
          * rather than sitting under what it holds. And every colour in it
          * was written out by hand, on the panel whose one job is to look
          * like the product it is part of.
          *
          * The plan's name moves up here. It was a chip in the body, which
          * meant it was the first thing to go once a conversation started,
          * and the one thing you most want confirmed while Whitby is
          * rewriting something is which plan it is rewriting.
          */}
        <div className="pa-ask-head flex shrink-0 items-center justify-between gap-3 px-5 pb-3 pt-4">
          <div className="flex min-w-0 items-center gap-2.5">
            {/* A tint rather than a solid block: the mark still reads as
                Whitby's, and the row still sits under what it holds. */}
            <span
              className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[10px]"
              style={{
                color: "var(--accent)",
                background:
                  "linear-gradient(160deg, color-mix(in srgb, var(--accent) 20%, #ffffff) 0%, color-mix(in srgb, var(--accent) 9%, #ffffff) 100%)",
                boxShadow:
                  "inset 0 1px 0 rgba(255,255,255,.9), inset 0 0 0 1px color-mix(in srgb, var(--accent) 22%, transparent), 0 1px 2px color-mix(in srgb, var(--accent) 14%, transparent)",
              }}
              aria-hidden
            >
              <svg width="18" height="18" viewBox="0 0 120 120" fill="none" aria-hidden>
                <path d="M40 46 60 22l20 24" stroke="currentColor" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M26 42h68c9.94 0 18 8.06 18 18v22c0 9.94-8.06 18-18 18H26C16.06 100 8 91.94 8 82V60c0-9.94 8.06-18 18-18Z" stroke="currentColor" strokeWidth="9" />
                <path d="M8 66h104M50 42 34 100M70 42l16 58" stroke="currentColor" strokeWidth="6.5" strokeLinecap="round" opacity="0.55" />
              </svg>
            </span>

            {/* The plan's name is not here. The panel opens from one plan,
                over that plan, and says "Let's update this plan" in the
                body — naming it a third time in the header is a header
                repeating the screen behind it. */}
            <div className="min-w-0 text-[15.5px] font-bold leading-tight tracking-[-0.3px]">
              Ask Whitby
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1">
            <Link
              href={freshHref}
              scroll={false}
              className="pa-ask-ghost rounded-full px-2.5 py-1 text-[12.5px] font-medium no-underline"
            >
              + New chat
            </Link>
            <button
              type="button"
              onClick={onClose}
              className="pa-ask-ghost flex h-8 w-8 items-center justify-center rounded-full"
              aria-label="Close"
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M6 6l12 12M18 6 6 18" />
              </svg>
            </button>
          </div>
        </div>

        {talking ? (
          <div ref={transcript} className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
            <div className="flex flex-col gap-3">{transcriptBody}</div>
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-6 pt-4">
            <h2
              className="shrink-0 text-[21px] font-bold leading-[1.3] tracking-[-0.5px]"
              style={{ color: "#17181a" }}
            >
              Let&apos;s update this plan
            </h2>
            {/*
              * Which plan, under the heading that promises to update it.
              *
              * "Let's update this plan" is a sentence with a pronoun in it,
              * and on a screen holding twelve of them the pronoun is the
              * whole question. Not in the header: the panel opens from one
              * plan and sits over it, so a name up there is a header
              * repeating the screen behind it.
              */}
            {planName ? (
              <span
                className="mt-2.5 inline-flex max-w-full shrink-0 items-center gap-2 self-start rounded-full py-1.5 pl-2.5 pr-3.5 text-[12.5px] font-semibold leading-snug"
                style={{
                  background:
                    "linear-gradient(160deg, color-mix(in srgb, var(--accent) 16%, #ffffff) 0%, color-mix(in srgb, var(--accent) 8%, #ffffff) 100%)",
                  color: "var(--accent)",
                  boxShadow:
                    "inset 0 1px 0 rgba(255,255,255,.9), inset 0 0 0 1px color-mix(in srgb, var(--accent) 18%, transparent)",
                }}
              >
                <span
                  aria-hidden
                  className="h-[6px] w-[6px] shrink-0 rounded-full"
                  style={{ background: "var(--accent)" }}
                />
                <span className="truncate">{planName}</span>
              </span>
            ) : null}

            {/*
              * One line, and the rest on a press.
              *
              * This was three paragraphs in a box that never shrank, on a
              * panel four hundred pixels wide. It took the top half of the
              * screen, it said the same thing on the fortieth visit as on
              * the first, and it squeezed the suggestions underneath it
              * until the last one was cut in half by the composer — the
              * only part of this panel somebody actually presses.
              */}
            <p
              className="mt-3 shrink-0 text-[13px] leading-[1.55]"
              style={{ color: "var(--text-secondary)" }}
            >
              Ask for a change and Whitby redraws the plan. Anything you do not
              mention stays as it is. It shows you what it is about to do and
              waits for a yes.
            </p>

            {/*
              * No disclosure here.
              *
              * "What else it can do" sat in the accent, directly above the
              * list of suggestions — which fill the box when you press
              * them. It looked like one of them and was used like one, so
              * the label of a control went to Whitby as a question.
              *
              * A second line of explanation was not worth a control that
              * could be mistaken for the thing under it. What Whitby can
              * make is better learned by asking it than by reading a
              * paragraph about it in a four hundred pixel column.
              */}

            {suggestions.length > 0 ? (
              <div className="mt-4 flex min-h-0 flex-1 flex-col">
                <div className="shrink-0 text-[11.5px] font-semibold uppercase tracking-[0.04em]" style={{ color: "#5c5e66" }}>
                  Ask Whitby to
                </div>
                {/*
                  Welcome has no chat — only this list may scroll on a short
                  screen. The rest of the empty panel stays fixed so opening
                  Ask Whitby does not start mid-scroll.
                */}
                <div className="mt-1.5 min-h-0 flex-1 overflow-y-auto overscroll-contain">
                  <div className="flex flex-col gap-0.5 pb-1">
                    {suggestions.map((line) => (
                      <button
                        key={line}
                        type="button"
                        onClick={() => setDraft(line)}
                        className="pa-ask-row -ml-1.5 flex w-[calc(100%+6px)] items-start gap-2.5 rounded-[12px] py-2 pl-1.5 pr-2 text-left"
                      >
                        <span
                          className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
                          style={{ background: "var(--accent-tint)", color: "var(--accent)" }}
                          aria-hidden
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M5 12h14M13 6l6 6-6 6" />
                          </svg>
                        </span>
                        <span className="pa-ask-row-label min-w-0 flex-1 text-[13.5px] leading-[1.45]" style={{ color: "#17181a" }}>
                          {line}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        )}

        <div
          className="shrink-0 px-6 pt-3.5"
          style={{
            borderTop: talking ? "1px solid rgba(230,227,218,.75)" : undefined,
            paddingBottom: "max(1.25rem, env(safe-area-inset-bottom))",
          }}
        >
          {composer}
        </div>
      </aside>
    );
  }

  return (
    <aside
      className="flex w-full shrink-0 flex-col self-start overflow-hidden rounded-card border border-line bg-surface"
      style={{ boxShadow: "0 1px 2px rgba(15,15,15,.04)" }}
      aria-label="Ask Whitby"
    >
      <div className="flex shrink-0 items-center gap-2.5 border-b border-line px-4 py-3">
        <span
          className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-[7px] text-[11px] font-bold text-white"
          style={{ background: "var(--accent)" }}
          aria-hidden
        >
          W
        </span>
        <span className="text-[14px] font-semibold" style={{ color: "var(--ink)" }}>
          Ask Whitby
        </span>
        <Link
          href={freshHref}
          scroll={false}
          className="ml-auto text-[12.5px] no-underline"
          style={{ color: "var(--accent)" }}
        >
          + New chat
        </Link>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close Ask Whitby"
          className="px-1 text-[15px] leading-none"
          style={{ color: "var(--text-disabled)" }}
        >
          ✕
        </button>
      </div>

      <div
        ref={transcript}
        className="flex max-h-[62vh] flex-col gap-4 overflow-y-auto px-4 py-4"
      >
        {empty ? (
          <>
            <div>
              <h2
                className="text-[19px] font-bold leading-[1.2]"
                style={{ margin: 0, color: "var(--ink)" }}
              >
                Change this plan by saying so
              </h2>
              <p
                className="mt-1.5 text-[13px] leading-[1.5]"
                style={{ margin: "6px 0 0", color: "var(--text-secondary)" }}
              >
                Whitby rewrites {planName} from what you ask and keeps everything you did not
                mention.
              </p>
            </div>
            {suggestions.length > 0 ? (
              <div className="flex flex-col">
                <span
                  className="mb-1.5 text-[11px] font-semibold uppercase tracking-[.05em]"
                  style={{ color: "var(--text-tertiary)" }}
                >
                  From this plan
                </span>
                {suggestions.map((line) => (
                  <button
                    key={line}
                    type="button"
                    onClick={() => setDraft(line)}
                    className="pa-whitby-suggestion flex items-start gap-2.5 border-b border-line px-1 py-2.5 text-left text-[13px] leading-[1.45] last:border-b-0"
                    style={{ color: "var(--ink)" }}
                  >
                    <span className="shrink-0" style={{ color: "var(--accent)" }} aria-hidden>
                      →
                    </span>
                    {line}
                  </button>
                ))}
              </div>
            ) : null}
          </>
        ) : null}
        {transcriptBody}
      </div>

      <div className="shrink-0 border-t border-line p-3">{composer}</div>
    </aside>
  );
}

function Exchange({
  asked,
  reply,
  typed,
  waiting,
  danger,
  sheet,
}: {
  asked?: string | null;
  reply?: string;
  typed?: string;
  waiting?: ReactNode;
  danger?: boolean;
  sheet?: boolean;
}) {
  return (
    <div className="flex flex-col gap-2.5">
      {asked ? (
        <div
          className={
            sheet
              ? "max-w-[92%] self-end rounded-[16px] px-3.5 py-2.5 text-[13.5px] leading-snug"
              : "ml-auto max-w-[88%] px-3 py-2 text-[12.5px] leading-[1.45] text-white"
          }
          style={
            sheet
              ? { background: "#e7f1fb", color: "#183347" }
              : { background: "var(--accent)", borderRadius: "10px 10px 3px 10px" }
          }
        >
          {asked}
        </div>
      ) : null}

      {waiting ? (
        <div
          className={
            sheet
              ? "flex items-center gap-[5px] self-start rounded-[16px] bg-white px-3.5 py-[11px]"
              : "flex max-w-[88%] items-center gap-[5px] border border-line bg-surface px-3 py-[11px]"
          }
          style={
            sheet
              ? { boxShadow: "0 1px 2px rgba(23,24,26,.04)" }
              : { borderRadius: "10px 10px 10px 3px" }
          }
          aria-live="polite"
        >
          <span className="sr-only">Whitby is working on it</span>
          {[0, 1, 2].map((index) => (
            <span
              key={index}
              aria-hidden
              className="whitby-thinking-dot block h-[5px] w-[5px] rounded-full"
              style={{
                background: sheet ? "#5c5e66" : "var(--text-tertiary)",
                animationDelay: `${index * 0.16}s`,
              }}
            />
          ))}
          <span
            className="ml-1 text-[12px]"
            style={{ color: sheet ? "#5c5e66" : "var(--text-secondary)" }}
            suppressHydrationWarning
          >
            {waiting}
          </span>
        </div>
      ) : null}

      {reply || typed ? (
        <div
          className={
            sheet
              ? "max-w-[92%] self-start rounded-[16px] px-3.5 py-2.5 text-[13.5px] leading-[1.55]"
              : "max-w-[88%] border px-3 py-2 text-[12.5px] leading-[1.55]"
          }
          style={
            sheet
              ? {
                  background: danger ? "var(--danger-action-bg)" : "#ffffff",
                  color: danger ? "var(--danger-action-fg)" : "#17181a",
                  boxShadow: "0 1px 2px rgba(23,24,26,.04)",
                }
              : {
                  borderRadius: "10px 10px 10px 3px",
                  background: danger ? "var(--danger-action-bg)" : "var(--surface-soft)",
                  borderColor: danger ? "var(--danger-action-border)" : "var(--border)",
                  color: danger ? "var(--danger-action-fg)" : "var(--ink)",
                }
          }
        >
          {typed ? <Typed text={typed} /> : <Lines text={reply ?? ""} />}
        </div>
      ) : null}
    </div>
  );
}

/**
 * A reply, laid out rather than poured in.
 *
 * `formatAskReply` flattens the answer into text — a heading on its own
 * line, then "• " in front of each bullet — and this bubble printed the
 * whole string with `whitespace-pre-line`. In a 380px panel that means a
 * bullet longer than one line wraps back to the left margin and runs under
 * its own dot, so a list of open requests reads as a paragraph with stray
 * dots in it.
 *
 * The dot becomes a column of its own and the text keeps its own edge. The
 * blank line between blocks becomes space, and the line above a run of
 * bullets is drawn as what it is.
 */
function Lines({ text }: { text: string }) {
  const rows = text.split("\n");

  return (
    <>
      {rows.map((row, index) => {
        const line = row.trimEnd();

        if (!line.trim()) return <span key={index} className="block h-2" aria-hidden />;

        if (line.startsWith("• ")) {
          return (
            <span key={index} className="flex gap-1.5">
              <span aria-hidden className="shrink-0 select-none">
                •
              </span>
              <span className="min-w-0 flex-1">{line.slice(2)}</span>
            </span>
          );
        }

        /* The line that introduces a list — "Open requests", "Your team" —
           has bullets under it and nothing else on it. */
        const heads = rows[index + 1]?.trimStart().startsWith("• ") ?? false;

        return (
          <span
            key={index}
            className={heads ? "mt-0.5 block font-semibold" : "block"}
          >
            {line}
          </span>
        );
      })}
    </>
  );
}

/**
 * An answer, written out at reading speed.
 *
 * Fast enough not to be a wait — the whole sentence lands in about a second —
 * and slow enough that it reads as something being said rather than as the
 * panel redrawing itself.
 */
function Typed({ text }: { text: string }) {
  const [shown, setShown] = useState(0);

  useEffect(() => {
    setShown(0);
    if (!text) return;

    const step = Math.max(1, Math.ceil(text.length / 40));
    const timer = setInterval(() => {
      setShown((at) => {
        const next = at + step;
        if (next >= text.length) clearInterval(timer);
        return Math.min(next, text.length);
      });
    }, 24);

    return () => clearInterval(timer);
  }, [text]);

  /* Through the same layout, so a list does not fall apart while it is being
     written and snap into place at the end. */
  return <Lines text={text.slice(0, shown)} />;
}
