import type { ReactNode } from "react";
import { Bin } from "@/whitbyos/components/Bin";
import Link from "next/link";
import { SubmitPlain } from "@/base/components/Submit";
import {
  approveClientNeed,
  askClientForRequirements,
  dropClientNeed,
} from "@/whitbyos/work-plans/actions";
import { askMessageHref, staffAskHref, type ClientAsk } from "@/whitbyos/lib/client-ask";
import {
  answeredNeeds,
  clientNeeds,
  needFieldId,
  needSections,
  saysWhoProvides,
  type ClientNeed,
  type NeedEdits,
  type NeedSource,
} from "@/whitbyos/lib/plan-requirements";
import { shortDate } from "@/whitbyos/lib/format";
import { AddNeedField } from "@/whitbyos/work-plans/[id]/components/AddNeedField";
import { SelectAllNeeds } from "@/whitbyos/work-plans/[id]/components/SelectAllNeeds";
import { AskSubmit } from "@/whitbyos/work-plans/[id]/components/AskSubmit";
import { ClientNeedsFold } from "@/whitbyos/work-plans/[id]/components/ClientNeedsFold";
import { NeedInfo } from "@/whitbyos/work-plans/[id]/components/NeedInfo";
import { ClearSuggestions } from "@/whitbyos/work-plans/[id]/components/ClearSuggestions";
import { DraftSuggestions } from "@/whitbyos/work-plans/[id]/components/DraftSuggestions";
import { SaveSuggestions } from "@/whitbyos/work-plans/[id]/components/SaveSuggestions";


/**
 * What the plan is waiting on the client for, and the one button that asks.
 *
 * Above the views on purpose. Every task has carried its `required_inputs`
 * since migration 074 and each one has said "not held yet" beside it ever
 * since, buried three clicks down inside a task nobody opens until they come
 * to do it. By then the passport should have been asked for a fortnight ago.
 *
 * Red until the client's answer is sitting in the form's own responses, green
 * from the moment it is. Nothing on this side is ever ticked by hand, which is
 * the whole reason the old label could not be believed.
 */
export function ClientNeedsPanel({
  planId,
  hasClient,
  streams,
  ask,
  edits,
  returnTo,
  justAsked,
  justReminded,
  error,
  proposals,
  lid = true,
}: {
  planId: string;
  /** False on the firm's own work, which has no client to ask. */
  hasClient: boolean;
  streams: NeedSource[];
  ask: ClientAsk | null;
  /** The professional's own additions and removals (migration 079). */
  edits: NeedEdits;
  /**
   * The firm's suggested first version for each proposable need (migration
   * 102). Empty on a plan nobody has drafted suggestions for, which is every
   * plan built before this existed.
   */
  proposals: Record<string, string>;
  /**
   * False on the checklist screen, which is nothing but this panel: a lid
   * there is a button that empties the page, and the title repeats the one
   * already at the top of it.
   */
  lid?: boolean;
  returnTo: string;
  /** How many went out just now, from the redirect. Null on an ordinary load. */
  justAsked: number | null;
  justReminded: boolean;
  /**
   * What went wrong last time, from the redirect.
   *
   * The panel had nowhere to print one, and the plan page only ever handed
   * `error` to dialogs — so a failed ask redirected back looking identical to
   * a button that had done nothing. It did that for a fortnight over a column
   * name that does not exist.
   */
  error: string | null;
}) {
  const needs = clientNeeds(streams, edits);

  /* Nobody to ask. The steps still say what they need and the task screens
     still print it; what there is no point drawing is a panel whose every
     button sends something to a client this plan does not have. */
  if (!hasClient) return null;

  // A plan that wants nothing from its client shows nothing, unless one has
  // already been asked — then the panel is where the answers come back to.
  if (needs.length === 0 && !ask) return null;

  /* A suggestion sits in the answer box from the moment it is sent, so
     without the third argument this panel would read the firm's own words
     back as the client's answer and call the list finished. */
  const done = answeredNeeds(needs, ask?.responses, {
    proposals,
    submitted: Boolean(ask?.submittedAt),
  });
  const guessed = !saysWhoProvides(streams);
  const waiting = needs.length - done.size;

  /*
   * Four states, and only one of them is a question.
   *
   *   accepted  somebody read what came back and said it would do
   *   received  the client's answer is in, and nobody has looked at it
   *   waiting   the question is on the form and unanswered
   *   fresh     the client has never been asked
   *
   * Only "fresh" carries a tick box. A question already on the form is one
   * the client is already looking at, so offering to ask for it again is
   * offering to do nothing, and a panel of ticked boxes beside twenty rows
   * marked Waiting reads as though none of it had been sent.
   *
   * Arriving and being good enough are different facts.
   *
   * These two used to be one state, which put "Received" in green beside a
   * passport scan nobody had opened. Only the second is somebody's judgement,
   * so green is kept for the judgement and what has merely landed says so.
   *
   * Accepted is read per answer rather than off the submission's status
   * (migration 080). The status covers the whole form, and this form grows:
   * adding a fifth question to one whose first four were accepted has to put
   * the submission back to `awaiting`, and that used to un-accept the four.
   * Compared by value, so an answer replaced since acceptance goes back to
   * being something nobody has looked at.
   */
  const isAccepted = (slug: string) => {
    const field = needFieldId(slug);
    const accepted = ask?.acceptedResponses[field];
    return Boolean(accepted) && accepted === ask?.responses[field];
  };

  // What came back and nobody has looked at yet: the panel's own queue.
  const unchecked = [...done].filter((slug) => !isAccepted(slug)).length;

  const state = (slug: string) =>
    done.has(slug)
      ? isAccepted(slug)
        ? "accepted"
        : "received"
      : ask?.fieldIds.has(needFieldId(slug))
        ? "waiting"
        : "fresh";

  const fresh = needs.filter((need) => state(need.slug) === "fresh");

  // What has not been asked for first, then what is still outstanding, then
  // what is in. Stable within each group, so the list does not reorder itself
  // every time an answer lands.
  /*
   * Whatever needs a person first.
   *
   * Something the client has sent and nobody has opened is the most urgent
   * thing on the panel and it was being sorted to the bottom, where the first
   * three rows hid it behind "Show the other 17" — so the two states this
   * panel exists to distinguish were the two nobody could see. Then what has
   * not been asked for, which is also somebody's move; then what is waiting on
   * the client, which is nobody's; then what is settled.
   */
  const rank = { received: 0, fresh: 1, waiting: 2, accepted: 3 } as const;
  const ordered = [...needs].sort((a, b) => rank[state(a.slug)] - rank[state(b.slug)]);

  /* Split after ordering, so each group keeps the same "whatever needs a
     person first" ranking rather than re-sorting itself. */
  const suggestible = ordered.filter((need) => need.proposable);
  const clientOnly = ordered.filter((need) => !need.proposable);

  const line = ask
    ? done.size === needs.length
      ? unchecked === 0
        ? `All ${needs.length} have arrived and been accepted.`
        : `All ${needs.length} have arrived. Open the form to look them over.`
      : `${done.size} of ${needs.length} have arrived${unchecked > 0 ? `, ${unchecked} to look over` : ""}. ${waiting} still to come.`
    : `${needs.length} ${needs.length === 1 ? "thing" : "things"} to ask for. Nothing is sent until you approve it.`;

  return (
    <ClientNeedsFold
      lid={lid}
      startOpen={Boolean(justAsked || justReminded || error || unchecked > 0 || fresh.length > 0)}
      /* "the client" is this firm's word for the other person, and the
         product is no longer only sold to firms: somebody running their own
         move or their own application is both sides of that sentence. What
         is needed is what is needed, whoever is being asked. */
      title="What we still need"
      line={line}
      count={needs.length}
      aside={
        ask ? (
          <Link
            href={staffAskHref(ask.submissionId)}
            className="shrink-0 text-[12.5px] font-medium no-underline"
            style={{ color: "var(--accent)" }}
          >
            {unchecked > 0 ? "Check what came back" : "See what came back"}
          </Link>
        ) : null
      }
    >

      {/* Said once, in place, rather than as a toast over the screen: the list
          below it has already changed to show what was sent. */}
      {error ? (
        <p
          className="border-b px-4 py-2.5 text-[12.5px]"
          style={{
            borderColor: "var(--border)",
            background: "var(--danger-bg)",
            color: "var(--danger-fg)",
            margin: 0,
          }}
        >
          {error}
        </p>
      ) : null}

      {(justAsked || justReminded) && ask ? (
        <div
          className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b px-4 py-2.5 text-[12.5px]"
          style={{
            borderColor: "var(--border)",
            background: "var(--success-bg)",
            color: "var(--success-fg)",
          }}
        >
          <span>
            {justReminded
              ? "Reminder sent."
              : `Sent. ${justAsked} ${justAsked === 1 ? "thing was" : "things were"} added to their form.`}{" "}
            They find it on their Home under Action needed, in Forms, and in
            Messages.
          </span>

          {/* Two links rather than a claim, because "it was sent" is only
              worth as much as being able to go and look at it. */}
          <span className="flex flex-wrap items-center gap-3">
            <Link
              href={staffAskHref(ask.submissionId)}
              className="font-medium no-underline"
              style={{ color: "var(--success-fg)" }}
            >
              See the form
            </Link>
            {ask.threadId ? (
              <Link
                href={askMessageHref(ask.threadId, ask.threadKind)}
                className="font-medium no-underline"
                style={{ color: "var(--success-fg)" }}
              >
                See the message
              </Link>
            ) : null}
          </span>
        </div>
      ) : null}

      {guessed ? (
        <p
          className="border-b px-4 py-2 text-[12px]"
          style={{
            borderColor: "var(--border)",
            background: "var(--warning-bg)",
            color: "var(--ink)",
            margin: 0,
          }}
        >
          This plan was drafted before Whitby started recording who provides
          each thing, so it has guessed: every document and every detail is
          treated as theirs to send. Open the full list and untick anything
          your own side provides, or they will be asked for it. Newer plans
          record this properly and are not guessed at.
        </p>
      ) : null}

      <form action={askClientForRequirements}>
        <input type="hidden" name="plan_id" value={planId} />
        <input type="hidden" name="return_to" value={returnTo} />

        {/* Above the first row and aligned with the column it governs, so it
            reads as the head of the ticks rather than as another one of them.
            Only where there is more than one thing to tick. */}
        {fresh.length > 1 ? (
          <div className="border-b" style={{ borderColor: "var(--border)" }}>
            <SelectAllNeeds total={fresh.length} />
          </div>
        ) : null}

        {/*
         * One fold, not two.
         *
         * There was a "show the other N" over the top of this, splitting the
         * list at the third row and rendering groups on both sides of the
         * split. So a group could be drawn twice, once with the needs that
         * happened to rank into the first three and once with the rest, each
         * half wearing a count of its own. Now that every group folds, the
         * outer fold is a fold of folds and is gone.
         */}
        {/*
          * Two kinds of ask, and they are not the same question.
          *
          * A passport can only come from the client, and a blank box is
          * exactly right. A menu, a shortlist, a running order is theirs to
          * decide and ours to draft: sending those blank is the firm handing
          * its own work to the person paying for it.
          *
          * Drawn apart rather than labelled, so the difference is the shape
          * of the screen rather than a word somebody has to read.
          */}
        {suggestible.length > 0 ? (
          <>
            {/*
              * The banner is this group's lid.
              *
              * Six rows each carrying a textarea is most of a screen, and
              * somebody who has read them wants them out of the way. The
              * group below folds by kind instead, so its banner is not a lid:
              * a fold over folds is the mistake this panel made once before,
              * where the outer one split the list and drew groups twice.
              *
              * Open to begin with, because it is the half with work in it.
              * Shut, the ticks and the boxes are still in the form: a
              * details hides its children, it does not unmount them.
              */}
            <details open className="group/suggest">
              <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                <GroupBanner
                  tone="suggest"
                  count={suggestible.length}
                  lid
                  title="We suggest, they approve"
                  blurb="A first version goes out in the box. The client leaves it as it is, or changes it."
                />
              </summary>
            {/*
              * Drafting sits above the boxes it fills.
              *
              * Both buttons used to be underneath, which put the one you
              * press first behind six empty boxes: to reach the thing that
              * fills them you scrolled past all of them. They belong at
              * opposite ends, because they belong to opposite moments.
              * Drafting is before you have read anything. Saving is after
              * you have written.
              */}
            <ProposeRow
              missing={suggestible.filter((need) => !proposals[need.slug]).length}
              anyFresh={suggestible.some((need) => state(need.slug) === "fresh")}
              where="above"
            />

            {/* Flat, not folded by kind.
                Every row in this group does the same thing: read the box and
                change it or leave it. Splitting them into "details" and
                "decisions" put the same heading on this screen twice, once
                here and once under the group below, where the split does
                earn its place: uploading a file, typing an answer and
                handing over an account are three different acts. */}
            <NeedGroups needs={suggestible} state={state} proposals={proposals} flat />
            <ProposeRow
              missing={suggestible.filter((need) => !proposals[need.slug]).length}
              anyFresh={suggestible.some((need) => state(need.slug) === "fresh")}
              /* How many editable rows still carry one, so "clear them all"
                 only appears when there is something to clear. */
              written={
                suggestible.filter(
                  (need) => state(need.slug) === "fresh" && proposals[need.slug],
                ).length
              }
              /* Ticked to go out with nothing suggested. Said here because
                 the send button is three lines below it, and a group headed
                 "we suggest" that sends empty boxes is a promise the screen
                 made and the message broke. */
              empty={
                suggestible.filter(
                  (need) => state(need.slug) === "fresh" && !proposals[need.slug],
                ).length
              }
              where="below"
            />
            </details>
          </>
        ) : null}

        {clientOnly.length > 0 ? (
          <>
            {suggestible.length > 0 ? (
              <GroupBanner
                tone="client"
                count={clientOnly.length}
                title="Only they can provide"
                blurb="Nobody here can draft these. They come from the client or from nowhere."
              />
            ) : null}
            <NeedGroups needs={clientOnly} state={state} />
          </>
        ) : null}

        {/*
         * Asking for something the plan never thought of.
         *
         * In the same form as everything else, sent to a different action by
         * `formAction`, so it inherits the plan id and the return path rather
         * than repeating them. Its own tick box is not needed: something
         * somebody has just typed out is something they want asked.
         */}
        <div
          className="flex flex-wrap items-end gap-2 border-t px-4 py-3"
          style={{ borderColor: "var(--border)" }}
        >
          <AddNeedField />
        </div>

        {/* A reminder adds no questions, so the action has to be told that
            rather than working it out from an empty tick list. */}
        {fresh.length === 0 ? (
          <input type="hidden" name="scope" value="remind" />
        ) : null}

        {done.size === needs.length ? null : (
          <div
            className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3"
            style={{ borderColor: "var(--border)" }}
          >
            {/* The count comes from the boxes, not from the rows: ticking one
                of eighteen and reading "Ask for the other 18" was the button
                describing what it could do rather than what it would. */}
            <AskSubmit
              fresh={fresh.length}
              remind={fresh.length === 0}
              note={
                fresh.length === 0
                  ? `Everything on this list has been asked for${ask?.sentAt ? `, last sent ${shortDate(ask.sentAt)}` : ""}. A reminder adds nothing new, it just asks again.`
                  : ask
                    ? "Whatever is ticked is added to the form they already have. Anything on it stays as it is."
                    : "One message and one form, with everything ticked in it — whether it is showing or folded away."
              }
            />
          </div>
        )}
      </form>
    </ClientNeedsFold>
  );
}

/**
 * The given needs under their own headings, each one folding.
 *
 * Twenty rows under five headings is still twenty rows: the headings said
 * which was which and nothing made a group any shorter, so the client's
 * list was a wall with labels in it. Each group folds now, the way the
 * client's own form has folded since it was written.
 *
 * Open where there is something to do in it, which is a need nobody has
 * asked for yet or an answer nobody has opened. A group that is entirely
 * waiting on the client is a group with nothing in it for the person
 * reading this, and it opens on a press.
 *
 * A `details` rather than state: the rows carry the checkboxes this form
 * submits, and a folded `details` keeps them in the DOM where a conditional
 * render would drop them and quietly change what was sent.
 */
function NeedGroups({
  needs,
  state,
  proposals,
  flat = false,
}: {
  needs: ClientNeed[];
  /** Draw the rows straight, with no per-kind fold over them. */
  flat?: boolean;
  state: (slug: string) => "accepted" | "received" | "waiting" | "fresh";
  /**
   * The firm's suggested first version, by slug. Empty on the client-only
   * group, which is the point of the split: nobody drafts a passport.
   */
  proposals?: Record<string, string>;
}) {
  return (
    <>
      {needSections(needs).map((section) => {
        const live = section.needs.filter((need) => {
          const here = state(need.slug);
          return here === "fresh" || here === "received";
        }).length;

        return (
        /* Closed to begin with, every one. The panel's first screen is the
           groups and their counts, which is the question "how much is this"
           answered in a few lines; open one when you mean to work through
           it. The suggested group is flat and has no fold at all. */
        <Fold
          key={section.kind}
          fold={!flat}
          summary={
            <summary className="flex cursor-pointer list-none items-center gap-2 px-4 pb-1.5 pt-3.5 [&::-webkit-details-marker]:hidden">
              <span
                aria-hidden
                className="text-[9px] transition-transform group-open:rotate-90"
                style={{ color: "var(--text-quiet)" }}
              >
                ▶
              </span>
              <span
                className="text-[11px] font-semibold uppercase tracking-[0.06em]"
                style={{ color: "var(--text-tertiary)" }}
              >
                {section.title}
              </span>
              <span
                className="rounded-full px-1.5 py-px text-[10.5px] font-semibold tabular-nums"
                style={{
                  background: live > 0 ? "var(--warning-bg)" : "var(--surface-active)",
                  color: live > 0 ? "var(--warning-fg)" : "var(--text-tertiary)",
                }}
              >
                {section.needs.length}
              </span>
            </summary>
          }
        >

          {section.needs.map((need) => (
            <NeedRow
              key={need.slug}
              need={need}
              here={state(need.slug)}
              proposals={proposals}
            />
          ))}
        </Fold>
        );
      })}
    </>
  );
}

/**
 * The fold over one kind of need, or nothing at all.
 *
 * `flat` groups have no fold, and the first two attempts at that both failed
 * in the same way: a `<details>` whose `<summary>` is hidden does not lose its
 * summary, it gains the browser's own, and the screen ended up with two rows
 * reading "Details" and no count. There is no hiding a summary. There is only
 * not having a details.
 */
function Fold({
  fold,
  summary,
  children,
}: {
  fold: boolean;
  summary: ReactNode;
  children: ReactNode;
}) {
  if (!fold) return <>{children}</>;

  return (
    <details className="group">
      {summary}
      {children}
    </details>
  );
}

/**
 * One thing the client has to provide, as a row.
 *
 * Its own component so the two groups can draw it, one inside a fold and one
 * without. It was written inline in the map, which is why the flat group's
 * first two attempts reached for ways to hide the fold rather than ways to
 * not have one.
 */
function NeedRow({
  need,
  here,
  proposals,
}: {
  need: ClientNeed;
  here: "accepted" | "received" | "waiting" | "fresh";
  proposals?: Record<string, string>;
}) {
  return (
    <div key={need.slug} className="border-b last:border-b-0" style={{ borderColor: "var(--border)" }}>
    <label
      className="flex cursor-pointer flex-col gap-3 px-4 py-3.5 transition-colors hover:bg-[var(--surface-soft)] sm:flex-row sm:items-start sm:gap-3"
      style={{ borderColor: "var(--border)" }}
    >
      <span className="flex min-w-0 flex-1 items-start gap-2.5">
        {/* A box only where there is something to decide. Once a
            question is on the form the decision has been made, and
            once the answer is in there is nothing left to ask. */}
        {here === "fresh" ? (
          <input
            type="checkbox"
            name="ask"
            value={need.slug}
            defaultChecked
            className="mt-1"
          />
        ) : (
          <span
            aria-hidden
            className="mt-1 text-[12px] leading-none"
            style={{
              color:
                here === "accepted"
                  ? "var(--success-fg)"
                  : here === "received"
                    ? "var(--accent)"
                    : "var(--text-quiet)",
            }}
          >
            ●
          </span>
        )}

        <span className="min-w-0 flex-1">
          <span className="flex items-start gap-0.5">
            <span
              className="min-w-0 text-[14px] font-medium leading-[1.4]"
              style={{
                color: here === "accepted" ? "var(--text-secondary)" : "var(--ink)",
              }}
            >
              {need.label}
            </span>
            <NeedInfo need={need} />
          </span>
          <span
            className="mt-1 block text-[12.5px] leading-[1.5]"
            style={{ color: "var(--text-tertiary)" }}
          >
            {need.neededBy.length === 0
              ? "You added this one"
              : need.neededBy.length === 1
                ? `Needed for ${need.neededBy[0]}`
                : `Needed for ${need.neededBy.length} tasks, starting with ${need.neededBy[0]}`}
          </span>
        </span>
      </span>

      <span className="flex shrink-0 flex-wrap items-center gap-2 pl-7 sm:pl-0 sm:pt-0.5">
        <span
          className="rounded-full px-2.5 py-1 text-[11px] font-semibold"
          style={
            here === "accepted"
              ? { background: "var(--success-bg)", color: "var(--success-fg)" }
              : here === "received"
                ? { background: "var(--accent-tint)", color: "var(--accent)" }
                : here === "waiting"
                  ? { background: "var(--warning-bg)", color: "var(--warning-fg)" }
                  : { background: "var(--danger-bg)", color: "var(--danger-fg)" }
          }
        >
          {here === "accepted"
            ? "Accepted"
            : here === "received"
              ? "Arrived, not checked"
              : here === "waiting"
                ? "Waiting"
                : "For your approval"}
        </span>

        {here === "fresh" ? (
          <SubmitPlain
            formAction={approveClientNeed.bind(null, need.slug)}
            title={`Approve and send this on its own: ${need.label}`}
            className="inline-flex shrink-0 items-center rounded-control border px-2.5 py-1 text-[12px] font-semibold transition-colors hover:bg-[var(--accent-tint)]"
            style={{ borderColor: "var(--accent)", color: "var(--accent)" }}
          >
            Approve
          </SubmitPlain>
        ) : null}

        {here === "received" ? null : (
          <SubmitPlain
            formAction={dropClientNeed.bind(null, need.slug)}
            title="Take this off the list"
            aria-label={`Take ${need.label} off the list`}
            className="inline-flex shrink-0 items-center rounded-control px-1.5 leading-none transition-colors hover:text-[var(--danger-fg)]"
            style={{ color: "var(--text-quiet)" }}
          >
            <Bin />
          </SubmitPlain>
        )}
      </span>
    </label>

    {/*
      * The suggestion, under the row it answers.
      *
      * Outside the label on purpose. A textarea inside one means
      * every click in it also toggles the tick box above, which is
      * somebody losing a question off the ask while correcting the
      * wording of it.
      *
      * Editable until it has gone out. After that it is what the
      * client is looking at, and changing it here would leave the
      * firm's screen disagreeing with their form.
      */}
    {need.proposable ? (
      <div className="px-4 pb-3.5 pl-11">
        {here === "fresh" ? (
          <textarea
            /* Keyed on the suggestion itself.
               `defaultValue` is read once, when the element is made, and an
               uncontrolled field keeps whatever is in it across a re-render.
               Without this the box held its old text after a draft or a
               clear had already replaced it on the server, so the screen and
               the table disagreed until somebody reloaded by hand. */
            key={proposals?.[need.slug] ?? "blank"}
            name={`proposal_${need.slug}`}
            defaultValue={proposals?.[need.slug] ?? ""}
            rows={proposals?.[need.slug] ? 5 : 2}
            placeholder="Write the suggestion, or let Whitby draft it from the button above"
            className="w-full rounded-control border px-3 py-2 text-[13px] leading-[1.55] outline-none transition-colors focus:border-[var(--accent)]"
            style={{
              borderColor: "var(--border-strong)",
              background: "var(--surface)",
              color: "var(--ink)",
            }}
          />
        ) : proposals?.[need.slug] ? (
          <p
            className="whitespace-pre-wrap rounded-control border px-3 py-2 text-[13px] leading-[1.55]"
            style={{
              margin: 0,
              borderColor: "var(--border)",
              background: "var(--surface-soft)",
              color: "var(--text-secondary)",
            }}
          >
            {proposals[need.slug]}
          </p>
        ) : null}
      </div>
    ) : null}
    </div>
  );
}

/**
 * Taking a question off the list, in the mark people read as "delete".
 *
 * A ✕ beside a row means both "close this" and "remove this" depending on
 * where it sits, and on a row that is already a checkbox and a pill it read
 * as the third state of something. A bin says which of the two it is.
 */

/**
 * The line that separates the two kinds of ask.
 *
 * Not a fold. Every group inside it folds already, and a fold of folds is the
 * mistake this panel made once before: the outer one split the list and drew
 * some groups twice, each half wearing a count of its own.
 */
function GroupBanner({
  title,
  blurb,
  count,
  tone,
  lid = false,
}: {
  title: string;
  blurb: string;
  count: number;
  /** Drawn as the lid of its own group, so it carries a chevron. */
  lid?: boolean;
  /**
   * Which of the two this is.
   *
   * The suggested group takes the accent, because it is the one with work in
   * it: boxes to read, a draft to run, wording to correct. The other is a
   * list of things to wait for. Drawn in the same grey, the reader had to
   * read both headings to find out which was which.
   */
  tone: "suggest" | "client";
}) {
  const accent = tone === "suggest";

  return (
    <div
      className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-t px-4 py-3"
      style={{
        borderColor: accent
          ? "color-mix(in srgb, var(--accent) 18%, var(--chrome-line))"
          : "var(--border)",
        background: accent ? "var(--accent-tint)" : "var(--surface-soft)",
      }}
    >
      {lid ? (
        <span
          aria-hidden
          className="shrink-0 text-[10px] transition-transform group-open/suggest:rotate-90"
          style={{ color: accent ? "var(--accent)" : "var(--text-quiet)" }}
        >
          ▶
        </span>
      ) : null}

      <div className="min-w-0 flex-1">
        <div
          className="text-[11.5px] font-semibold uppercase tracking-[0.08em]"
          style={{ color: accent ? "var(--accent)" : "var(--text-secondary)" }}
        >
          {title}
        </div>
        <p
          className="mt-0.5 text-[12px] leading-[1.45]"
          style={{ margin: "2px 0 0", color: "var(--text-tertiary)" }}
        >
          {blurb}
        </p>
      </div>

      {/* The count sits on the banner now rather than only on the folds
          beneath it, because the suggested group has no folds to carry it
          and a group that would not say how big it was read as an aside. */}
      <span
        className="shrink-0 rounded-full px-2 py-[2px] text-[11.5px] font-semibold tabular-nums"
        style={{
          background: accent ? "var(--accent)" : "var(--surface-active)",
          color: accent ? "#fff" : "var(--text-tertiary)",
        }}
      >
        {count}
      </span>
    </div>
  );
}

/**
 * The two buttons that belong to the suggestions.
 *
 * `formAction` rather than forms of their own: this whole panel is one form,
 * and a nested one is invalid HTML that browsers silently discard. They
 * inherit the plan id and the return path from it, the same way Approve and
 * the bin already do.
 *
 * Saving is offered whenever a box is editable, because a professional who
 * has just rewritten a menu needs somewhere to put it. Drafting is offered
 * only while something has no suggestion at all: asking Whitby again for one
 * somebody has already corrected is offering to overwrite their work, and
 * `proposeClientItems` refuses to do it anyway.
 */
function ProposeRow({
  missing,
  anyFresh,
  where,
  written = 0,
  empty = 0,
}: {
  missing: number;
  anyFresh: boolean;
  /** Suggested rows still carrying nothing, which would go out blank. */
  empty?: number;
  /** Editable rows that already carry a suggestion. */
  written?: number;
  /** Above the boxes it fills, or below the boxes it saves. */
  where: "above" | "below";
}) {
  if (!anyFresh) return null;

  const above = where === "above";
  /* Nothing left to draft, so the top row has nothing to say. */
  if (above && missing === 0) return null;

  return (
    <div
      className={`flex flex-wrap items-center gap-2 px-4 py-2.5 ${above ? "border-b" : "border-b border-t"}`}
      style={{ borderColor: "var(--border)" }}
    >
      {above ? (
        <>
          <DraftSuggestions missing={missing} />
        </>
      ) : (
        <>
          <SaveSuggestions />

          {/*
            * Start again, in one press rather than six.
            *
            * Quiet, and only where there is something to clear. It posts the
            * same boxes as everything else, and the action clears exactly the
            * ones it was sent: a suggestion already on the client's form is
            * drawn read-only, has no box, and so cannot be taken off our
            * screen while they are still looking at it.
            */}
          {written > 0 ? <ClearSuggestions count={written} /> : null}

          {/* Said here rather than only at the foot of the page, because
              this is where somebody stops editing and wonders whether the
              thing they just typed has gone anywhere yet. Sending saves it
              too, so neither button can lose an edit. */}
          <span
            className="text-[11.5px] leading-[1.4]"
            style={{ color: empty > 0 ? "var(--warning-fg)" : "var(--text-faint)" }}
          >
            {empty > 0
              ? `${empty === 1 ? "One of these has" : `${empty} of these have`} nothing suggested yet and would go out as an empty box.`
              : "Approve and send saves these as well. Nothing reaches the client until you do."}
          </span>
        </>
      )}
    </div>
  );
}
