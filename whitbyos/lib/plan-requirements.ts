/**
 * What a plan needs the client to hand over, worked out from its own tasks.
 *
 * Every task already carries `requiredInputs` — the drafter has been writing
 * them since migration 074 — and the task screen has been printing "not held
 * yet" beside them ever since. That phrase was never true: nothing checked,
 * nothing could be handed over, and the words stayed the same after the
 * passport arrived. This module is the other half, so the list can be asked
 * for in one message and go green when it lands.
 *
 * Pure, and tested, for the same reason `plan-derive` is: every fault this
 * area has had was a screen asserting something no row supported.
 */

import type { NeedPlace, TaskRequirement } from "@/whitbyos/lib/work-plans";

export type { NeedPlace };

/**
 * The little of a plan this module actually reads.
 *
 * Narrower than `PlanWorkstream` on purpose: the button that sends the ask
 * would otherwise have to load a whole plan — its risks, its feasibility, its
 * owner's photograph — to find out which documents to ask a client for. A
 * `PlanWorkstream[]` still satisfies this, so the screens pass what they
 * already have.
 */
export type NeedSource = {
  tasks: {
    title: string;
    requiredInputs: TaskRequirement[];
    /**
     * When the task waiting on it is due, which is the only honest answer to
     * "by when?". Optional, so a caller with narrower rows still satisfies
     * this; a need whose tasks have no dates simply has no date.
     */
    due_date?: string | null;
  }[];
};

/** One thing the client has to provide, however many tasks are waiting on it. */
export type ClientNeed = {
  /**
   * The identity a need keeps across tasks and across repeated asks. Two tasks
   * both wanting "Both adults' passports" are one thing to ask for, and asking
   * twice in one message is how a client stops reading it.
   */
  slug: string;
  kind: TaskRequirement["kind"];
  label: string;
  /** The tasks waiting on it, so the client is told what it is holding up. */
  neededBy: string[];
  /**
   * What the work needs it for. Null where nothing said.
   *
   * A bare list of nouns — Passport copy, Proof of address, Bank statements —
   * reads as paperwork for its own sake, and the question that comes back is
   * always the same one. The plan knows the answer, so the ask carries it.
   */
  why: string | null;
  /**
   * Where it is handed over. The portal unless something says otherwise: that
   * is where the ask lands, as a form, so it is the true answer for anything
   * that can be uploaded or typed.
   */
  where: NeedPlace;
  /**
   * By when, as the date of the first task waiting on it.
   *
   * Derived, never asked of the model: a deadline invented by a drafter is a
   * deadline somebody works to. Null where no task waiting on it has a date.
   */
  dueBy: string | null;
  /**
   * True where the professional added it rather than the drafter finding it.
   * Such a need has no task behind it, which is why `neededBy` is empty on one
   * and why the screen says who put it there instead of what it is holding up.
   */
  added?: boolean;
  /**
   * Whether this is a suggestion to approve rather than a blank to fill.
   *
   * The client-facing list has always been one kind of thing: a box with a
   * label on it. Two kinds live in it. A passport can only come from the
   * client and a blank box is the right question. A menu, a shortlist, a
   * running order is theirs to decide and ours to draft, and a blank box for
   * one of those is the firm handing its work to the person paying for it.
   *
   * True marks the second. Those go out carrying a first version, and the
   * client approves it or changes it. See `DraftedRequirement.proposable`.
   */
  proposable?: boolean;
};

/**
 * The professional's own edits to the gathered list (migration 079).
 *
 * The drafter is a good first pass and not the last word: it misses things the
 * work turns up later, and it is sometimes wrong about who holds what. These
 * two overrule it in both directions.
 */
export type NeedEdits = {
  /** Asked for although no task named it, with why where they said. */
  extra?: {
    slug: string;
    label: string;
    kind: TaskRequirement["kind"];
    why?: string | null;
  }[];
  /** Gathered from a task, but not asked of this client. */
  skip?: string[];
};

/** A heading in the form the client fills in, and what goes under it. */
export type NeedSection = {
  kind: TaskRequirement["kind"];
  title: string;
  blurb: string;
  needs: ClientNeed[];
};

/**
 * The order the sections run in, and what each one is called to a client.
 *
 * Not the raw `kind` values: "information" is a database word, and a person
 * reading a form should be told what is wanted, not what column it came from.
 */
const SECTIONS: Record<TaskRequirement["kind"], { title: string; blurb: string }> = {
  document: {
    title: "Documents to upload",
    blurb: "Attach a scan or a photo of each one. Anything readable is fine.",
  },
  information: {
    title: "Details we need from you",
    blurb: "Short answers. Write what you know and leave the rest.",
  },
  approval: {
    title: "Decisions we need from you",
    blurb: "Work below these cannot start until you have answered.",
  },
  account: {
    title: "Accounts and access",
    blurb: "Logins or reference numbers that are yours rather than ours.",
  },
  contact: {
    title: "People we need to reach",
    blurb: "A name and a way to reach them is enough.",
  },
};

/** The order sections appear in: what is most often wanted comes first. */
const ORDER: TaskRequirement["kind"][] = [
  "document",
  "information",
  "approval",
  "account",
  "contact",
];

/**
 * Which kinds are assumed to be the client's on a plan drafted before `from`
 * existed. Documents and details are nearly always theirs; an account or a
 * contact is as often the firm's own. Used only as a fallback, and the screen
 * says when it is being used.
 */
const CLIENT_BY_DEFAULT = new Set<TaskRequirement["kind"]>(["document", "information"]);

/** What the drafter said this is for, or nothing. Never the label again. */
function reasonOf(input: TaskRequirement): string | null {
  const why = input.why?.trim();
  if (!why) return null;
  // "Passport copy — needed because we need the passport copy" is the model
  // filling a required field rather than answering it, and a reason that only
  // repeats the label is worse than a blank: it looks like an answer.
  if (needSlug(why) === needSlug(input.label ?? "")) return null;
  return why;
}

/** Where it is handed over. The portal unless the plan says otherwise. */
function placeOf(input: TaskRequirement): NeedPlace {
  return input.where ?? "client_portal";
}

/**
 * Whether the firm could put a first version forward instead of asking blank.
 *
 * Two guards rather than one, because being wrong here is worse in one
 * direction than the other. A blank ask for something we could have drafted
 * wastes the client's time; a suggestion for something only they hold is the
 * product inventing the contents of their passport.
 *
 * So a `document` is never proposable whatever the model said — that is the
 * kind that means "a thing you already have" — and neither is anything that
 * does not come through the portal, because an original posted to the office
 * is by definition a physical object rather than a decision.
 */
function proposableOf(input: TaskRequirement): boolean {
  if (input.proposable !== true) return false;
  if (input.kind === "document") return false;
  if (placeOf(input) !== "client_portal") return false;
  return true;
}

function dueOf(task: { due_date?: string | null }): string | null {
  return task.due_date?.trim() || null;
}

/** The earlier of two dates, either of which may be missing. ISO sorts. */
function earlier(a: string | null, b: string | null): string | null {
  if (!a) return b;
  if (!b) return a;
  return a <= b ? a : b;
}

/**
 * Where it is handed over, said to the professional.
 *
 * These read on the plan, which is the firm's screen — so "Your Client
 * Portal, on the form we send" was the product talking to the wrong person:
 * the reader has no portal account and never will. They are written as what
 * happens rather than as an instruction to the reader, so the line answers
 * the question it is under: where does this actually reach us?
 *
 * Written here rather than by the model, so nobody is ever sent to a screen
 * this product does not have.
 */
export function needPlaceText(place: NeedPlace): string {
  switch (place) {
    case "by_post":
      return "Posted to the office or brought in — the original, not a scan";
    case "in_person":
      return "Handed over in person, at the appointment";
    case "elsewhere":
      return "Goes straight to the office that asked for it, not to us";
    default:
      return "Uploaded in the Portal, on the form we send";
  }
}

/**
 * By when, said as the thing it is holding up rather than as a bare date.
 *
 * "Before we can start Submit visa application" is a reason to go and find the
 * passport. A date on its own is something the reader has to work the meaning
 * of out for, so it comes with the step, and only where a step has one.
 *
 * `dateText` is passed in rather than formatted here: this module is pure and
 * tested, and a date formatter reaches for the reader's locale.
 */
export function needWhen(need: ClientNeed, dateText: string | null): string | null {
  const step = need.neededBy[0];
  if (!step) return dateText ? `By ${dateText}` : null;
  const before = `Before we can start ${step}`;
  return dateText ? `${before}, due ${dateText}` : before;
}

/** The form field a need's answer hangs off. Stable, so re-asking reuses it. */
export function needFieldId(slug: string): string {
  return `need-${slug}`;
}

/**
 * Two labels naming the same thing collapse to one slug: case, punctuation and
 * spacing all vary between tasks because each was written on its own.
 */
export function needSlug(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/**
 * True when this plan's requirements were drafted with `from` on them.
 *
 * One requirement carrying it is enough: the field is `required` in the
 * schema, so a plan either has it throughout or predates it entirely.
 */
export function saysWhoProvides(streams: NeedSource[]): boolean {
  return streams.some((stream) =>
    stream.tasks.some((task) => task.requiredInputs.some((input) => Boolean(input.from))),
  );
}

/**
 * Everything the client still has to provide, deduplicated, in plan order.
 *
 * `alreadyHeld === true` is dropped: the firm was told it has that one, and
 * asking for it anyway is the kind of message that teaches a client to ignore
 * the next one. `alreadyHeld` being false or absent both mean not held, which
 * is why this reads for true rather than against false.
 */
export function clientNeeds(streams: NeedSource[], edits?: NeedEdits): ClientNeed[] {
  const known = saysWhoProvides(streams);
  const found = new Map<string, ClientNeed>();
  const skip = new Set(edits?.skip ?? []);

  for (const stream of streams) {
    for (const task of stream.tasks) {
      for (const input of task.requiredInputs) {
        const label = input.label?.trim();
        if (!label) continue;

        const theirs = known
          ? input.from === "client"
          : CLIENT_BY_DEFAULT.has(input.kind);
        if (!theirs) continue;
        if (input.alreadyHeld === true) continue;

        const slug = needSlug(label);
        if (!slug) continue;
        // Left out by hand. The requirement stays on its task; this plan just
        // does not ask its client for it.
        if (skip.has(slug)) continue;

        const already = found.get(slug);
        if (already) {
          // The same need reached from a second task. One entry, both reasons:
          // a client who knows two things are waiting on their passport sends
          // it sooner than one who thinks it is a formality.
          if (!already.neededBy.includes(task.title)) already.neededBy.push(task.title);
          // The first task to say why keeps the reason; the earliest date
          // wins, because that is the one the client has to work to.
          already.why = already.why ?? reasonOf(input);
          already.dueBy = earlier(already.dueBy, dueOf(task));
          // Somewhere other than the portal outranks the portal: a need one
          // task can take as an upload and another needs the original of is
          // a need for the original.
          if (already.where === "client_portal") already.where = placeOf(input);
          /* One task calling it proposable and another not is a need only one
             of them could be proposed for, and the blank ask is the safe half.
             False wins, the same way the stricter `where` does. */
          if (input.proposable !== true) already.proposable = false;
          continue;
        }

        found.set(slug, {
          slug,
          kind: input.kind,
          label,
          neededBy: [task.title],
          why: reasonOf(input),
          where: placeOf(input),
          dueBy: dueOf(task),
          proposable: proposableOf(input),
        });
      }
    }
  }

  // Added last, and never overwriting a gathered one: a hand-added need that
  // collided with a drafted one would silently drop the task list that told
  // the client what it was holding up.
  for (const one of edits?.extra ?? []) {
    const label = one.label?.trim();
    const slug = one.slug?.trim();
    if (!label || !slug || found.has(slug) || skip.has(slug)) continue;

    found.set(slug, {
      slug,
      kind: one.kind,
      label,
      neededBy: [],
      added: true,
      // Whoever added it may have said why. Nothing is invented where they
      // did not, and there is no task behind one of these to take a date from.
      why: one.why?.trim() || null,
      where: "client_portal",
      dueBy: null,
    });
  }

  return [...found.values()];
}

/** The edits as they come off `whitbyos_workplans`, which is untyped jsonb. */
export function readNeedEdits(extra: unknown, skip: unknown): NeedEdits {
  const kinds = new Set<TaskRequirement["kind"]>([
    "document",
    "information",
    "approval",
    "account",
    "contact",
  ]);

  return {
    extra: (Array.isArray(extra) ? extra : []).flatMap((raw) => {
      if (!raw || typeof raw !== "object") return [];
      const row = raw as Record<string, unknown>;
      if (typeof row.slug !== "string" || typeof row.label !== "string") return [];
      const kind = kinds.has(row.kind as TaskRequirement["kind"])
        ? (row.kind as TaskRequirement["kind"])
        : "document";
      // Added before the reason was asked for: those rows have no `why`, and
      // that is a blank rather than a reason to drop the row.
      const why = typeof row.why === "string" && row.why.trim() ? row.why.trim() : null;
      return [{ slug: row.slug, label: row.label, kind, why }];
    }),
    skip: (Array.isArray(skip) ? skip : []).filter(
      (one): one is string => typeof one === "string" && one.length > 0,
    ),
  };
}

/** The same needs, grouped into the sections the client sees. */
export function needSections(needs: ClientNeed[]): NeedSection[] {
  return ORDER.flatMap((kind) => {
    const mine = needs.filter((need) => need.kind === kind);
    if (mine.length === 0) return [];
    return [{ kind, title: SECTIONS[kind].title, blurb: SECTIONS[kind].blurb, needs: mine }];
  });
}

/**
 * The field type a need is asked with.
 *
 * A document wants a file and nothing else will do. A decision is a yes or a
 * no, and a tri-state select can tell "No" from "not answered" where a
 * checkbox cannot. Everything else is a line of text.
 */
export function needFieldType(kind: TaskRequirement["kind"]): string {
  if (kind === "document") return "file";
  if (kind === "approval") return "boolean";
  return "short";
}

/**
 * Which needs have actually been answered, read from the submission's own
 * responses rather than from anything the firm wrote down.
 *
 * This is the whole point of deriving it: a client cannot update a row on the
 * firm's side, so any "received" flag the firm kept would have to be written
 * by the firm, and would be a claim about the client rather than a fact from
 * them. The answer itself is the fact.
 */
export function answeredNeeds(
  needs: ClientNeed[],
  responses: Record<string, string> | null | undefined,
  /**
   * What was suggested, and whether the client has sent the form back.
   *
   * A proposable need goes out with the firm's own first version already in
   * the box, so the client can approve it by leaving it alone. That means its
   * response is non-empty from the moment it is sent, and without this the
   * plan would count its own words as the client's answer and report a list
   * as complete before anybody had read it.
   *
   * Once the form comes back, the suggestion left untouched is an approval
   * and a changed one is an edit. Both are answers.
   */
  proposed?: { proposals?: Record<string, string>; submitted?: boolean },
): Set<string> {
  const answers = responses ?? {};
  const done = new Set<string>();

  for (const need of needs) {
    const value = answers[needFieldId(need.slug)];
    if (typeof value !== "string" || value.trim().length === 0) continue;

    const suggestion = proposed?.proposals?.[need.slug]?.trim();
    if (suggestion && !proposed?.submitted && value.trim() === suggestion) continue;

    done.add(need.slug);
  }

  return done;
}

/** What has become of a suggestion the firm put to the client. */
export type ProposalState = "suggested" | "waiting" | "approved" | "edited";

/**
 * Where one proposable need has got to.
 *
 * Four states rather than the two a blank ask has, because a suggestion has a
 * life a blank box does not: it is written, it goes out, and it comes back
 * either untouched or changed. "Approved as suggested" and "the client
 * rewrote it" are different facts and the professional needs both.
 *
 * Null where the need is not one of these at all, which is most of them.
 */
export function proposalState(
  need: ClientNeed,
  proposals: Record<string, string> | null | undefined,
  ask: { fieldIds: Set<string>; responses: Record<string, string>; submittedAt: string | null } | null,
): ProposalState | null {
  if (!need.proposable) return null;

  const suggestion = proposals?.[need.slug]?.trim();
  if (!suggestion) return null;

  const fieldId = needFieldId(need.slug);
  /* Drafted but not yet part of any form the client can see. */
  if (!ask || !ask.fieldIds.has(fieldId)) return "suggested";
  if (!ask.submittedAt) return "waiting";

  const answer = (ask.responses[fieldId] ?? "").trim();
  /* Nothing back for a field that went out carrying the suggestion means the
     client cleared the box, which is neither an approval nor an edit of ours.
     Treated as an edit: they have said something, and it is not our text. */
  return answer === suggestion ? "approved" : "edited";
}

/** Section headings for the panel, with each need's state already worked out. */
export function needsWithState(
  streams: NeedSource[],
  responses: Record<string, string> | null | undefined,
  edits?: NeedEdits,
): { sections: NeedSection[]; answered: Set<string>; total: number; guessed: boolean } {
  const needs = clientNeeds(streams, edits);
  return {
    sections: needSections(needs),
    answered: answeredNeeds(needs, responses),
    total: needs.length,
    guessed: needs.length > 0 && !saysWhoProvides(streams),
  };
}

/** What a screen may truthfully say beside one requirement. */
export type RequirementState = {
  text: string;
  tone: "success" | "waiting" | "neutral";
};

/**
 * The words beside a requirement, and null where there are none to be had.
 *
 * This replaces "not held yet", which the task screen printed beside every
 * requirement whose `alreadyHeld` was not true. It was never checked against
 * anything: nothing read the document store, there was no way for the client
 * to hand anything over, and the words did not change once it arrived. Three
 * separate screens have now been corrected for saying something no row
 * supported, so this returns null rather than reaching for a phrase.
 *
 * `ctx` is the plan's ask, where the caller has it. Without one, only what the
 * requirement says about itself can be reported.
 */
export function requirementState(
  input: TaskRequirement,
  ctx: {
    asked: boolean;
    answered: Set<string>;
    guessing: boolean;
    /** Slugs the professional took off this plan's ask (migration 079). */
    skipped?: Set<string>;
  } | null,
): RequirementState | null {
  // The firm was told it has this. Said first: it outranks any ask, and an
  // item already in hand is never chased.
  if (input.alreadyHeld === true) return { text: "on file", tone: "success" };

  const label = input.label?.trim();
  if (!label) return null;

  const slug = needSlug(label);

  if (ctx?.answered.has(slug)) {
    return { text: "sent by the client", tone: "success" };
  }

  // Taken off the ask by hand. The requirement is still true and still on this
  // task; what is no longer true is that the client is the one being asked, so
  // this says nothing rather than "not asked for yet" at something nobody
  // intends to ask for.
  if (ctx?.skipped?.has(slug)) return null;

  const theirs = ctx?.guessing
    ? CLIENT_BY_DEFAULT.has(input.kind)
    : input.from === "client";

  if (theirs) {
    return ctx?.asked
      ? { text: "asked for, waiting", tone: "waiting" }
      : { text: "not asked for yet", tone: "waiting" };
  }

  // Not the client's. Worth saying, because a professional reading a list of
  // six things is entitled to know which of them are their own to produce.
  if (input.from === "firm") return { text: "ours to provide", tone: "neutral" };
  if (input.from === "third_party") {
    return { text: "issued by a third party", tone: "neutral" };
  }

  // A plan drafted before `from`, for a kind the fallback does not claim.
  // Nothing is known about it, so nothing is said about it.
  return null;
}

/**
 * The little of a plan the professional's own checklist reads.
 *
 * Wider than `NeedSource` because this one cares what the task is, not only
 * what it wants: an approval is on this list because of its kind, and a
 * finished task is off it whatever it once needed.
 */
export type OwnSource = {
  tasks: {
    id: string;
    title: string;
    status: string;
    kind: "auto" | "approval" | "manual";
    requiredInputs: TaskRequirement[];
    due_date?: string | null;
  }[];
};

/** One thing on the professional's own list, and why it is theirs. */
export type OwnItem = {
  /** Stable within a plan, so a row can be linked and counted. */
  key: string;
  label: string;
  /**
   * Which of the two kinds of "only you" this is.
   *
   * `decide` is a task whose whole purpose is somebody saying yes, and
   * `provide` is something the firm has to produce or lay hands on. They are
   * different acts and the screen says which.
   */
  kind: "decide" | "provide";
  /** The task it belongs to, so the row opens the work rather than a dead end. */
  taskId: string;
  taskTitle: string;
  /** What it is for, where the plan said. Null rather than invented. */
  why: string | null;
  dueBy: string | null;
};

const DONE_STATUS = new Set(["complete", "completed", "done", "cancelled"]);

/**
 * What only the professional can do, worked out from the plan's own tasks.
 *
 * The client's half of this list has existed for a while; this is the other
 * half, and the two are a pair. Whitby does what it can (migration 101), the
 * client is asked for what only they hold, and what is left over is this: the
 * decisions nobody else can make and the things the firm itself has to
 * produce.
 *
 * Deliberately narrow. The brief says both lists must stay short, and the way
 * to keep a derived list short is to be strict about what earns a place on it
 * rather than to cut the end off a long one. So: approvals, because an
 * approval is a person saying yes by definition, and requirements marked
 * `from: "firm"` that nobody has yet, because those are the firm's own
 * homework. Everything else on a plan is ordinary work with an owner and a
 * date, and it is already on the plan.
 */
export function firmNeeds(streams: OwnSource[]): OwnItem[] {
  const found: OwnItem[] = [];
  const seen = new Set<string>();

  for (const stream of streams) {
    for (const task of stream.tasks) {
      if (DONE_STATUS.has(String(task.status).toLowerCase())) continue;

      /* The task itself, where the task is the decision. */
      if (task.kind === "approval") {
        const key = `decide:${task.id}`;
        if (!seen.has(key)) {
          seen.add(key);
          found.push({
            key,
            label: task.title,
            kind: "decide",
            taskId: task.id,
            taskTitle: task.title,
            why: null,
            dueBy: dueOf(task),
          });
        }
      }

      for (const input of task.requiredInputs) {
        const label = input.label?.trim();
        if (!label) continue;
        if (input.from !== "firm") continue;
        /* On file already. The client's list drops these for the same
           reason: a list that chases what you have is a list you stop
           reading. */
        if (input.alreadyHeld === true) continue;

        const slug = needSlug(label);
        if (!slug) continue;

        const key = `provide:${slug}`;
        if (seen.has(key)) continue;
        seen.add(key);

        found.push({
          key,
          label,
          kind: "provide",
          taskId: task.id,
          taskTitle: task.title,
          why: reasonOf(input),
          dueBy: dueOf(task),
        });
      }
    }
  }

  /* What is due soonest first, then what has no date at all. A list of six
     things needs an order and the only honest one here is time. */
  return found.sort((a, b) => {
    if (a.dueBy === b.dueBy) return 0;
    if (!a.dueBy) return 1;
    if (!b.dueBy) return -1;
    return a.dueBy < b.dueBy ? -1 : 1;
  });
}
