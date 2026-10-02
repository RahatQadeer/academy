import { generateJson } from "@/whitbyos/lib/ai/provider";
import type { AiResult } from "@/whitbyos/lib/ai/provider";
import { tidy } from "@/whitbyos/lib/ai/auto-draft-guard";
import type { AutoDraft } from "@/whitbyos/lib/ai/auto-draft-guard";

export type { AutoDraft, DraftSection } from "@/whitbyos/lib/ai/auto-draft-guard";

/**
 * Whitby doing a task it is allowed to do, rather than describing it.
 *
 * Every drafted task is classified `auto`, `approval` or `manual`, and the
 * drafter has been getting that right for a year: `auto` means organising,
 * researching, summarising or drafting internal material, reversible, nothing
 * leaving the firm. Nothing ever read the value. Whitby would write "draft the
 * ToR1 inventory" onto a coordinator's list, having been the one to decide it
 * was work no person needed to do.
 *
 * So this takes one `auto` task and produces the first pass of the thing
 * itself. Not a plan for the work, the work: the actual checklist, the actual
 * comparison, the actual summary, in enough detail that the professional's job
 * becomes reading and correcting rather than starting.
 *
 * Three lines it does not cross, and all three are in the prompt and enforced
 * again by the caller:
 *
 * - Nothing here is ever shown to a client. SRS 12.1.5 keeps every external
 *   send behind a person, and the one path from this product to a client is
 *   still `askClientForRequirements`, which runs from a button.
 * - Nothing is invented. A draft that guesses a reference number looks
 *   finished and is worse than an empty one, so anything the model was not
 *   told goes in `openPoints` and the task stays open because of it.
 * - The task is never completed. A machine marking work done is how work that
 *   was not done stops being visible.
 */
const SYSTEM = `You are a chief of staff at a professional firm. A task on a work plan has been classified as internal work that does not need the professional to do it personally: organising, researching, summarising, or drafting internal material.

Do that task now, as far as it can honestly be done from what you were given, and hand back the result.

Produce the work itself, not a description of it and not a plan for it. If the task is to prepare a checklist, write the checklist. If it is to compare options, write the comparison. If it is to summarise something, write the summary. The professional should be able to read what you return and correct it, rather than start it.

The commonest way to get this wrong is to write the container instead of the contents. A structure, a skeleton, a framework, a template, a tracker and a method are all the shape of the work with the work left out, and the professional already had the shape: it is on the task as its steps. "Draft menu options" means write the menus, with dishes in them. "Draft the running order" means write the order, with events and times in it. "Draft the invitation wording" means write the wording.

Ask yourself before you answer: could a competent person do this task from general knowledge and the brief, without looking anything up? If yes, do it, and write the actual content.

Only where the work genuinely cannot be done without facts you were not given, a venue's real availability, a client's actual guest list, a supplier's current prices, is the method an honest answer. In that case say plainly at the top that this is the method and not the result, list exactly what is missing in "openPoints", and still write as much real content as the facts you do have allow.

Where a detail is unknown, leave a clearly marked blank inside the real content, for example "Speech, [name]", rather than replacing the content with a description of what would go in it.

Keep it to about ten lines. That is the whole draft, not each section. This is the first thing somebody sees when they open a task, and a draft nobody reads has done nothing.

Length must come from substance, never from repetition. Forty rows where every field is a blank is a long draft carrying almost nothing: eight real candidates with what separates them is worth more and takes less reading. Where a list could run long, give the best handful, say how many more there are and where the rest come from, and stop.

Absolute limits:

- Never write anything intended for a client to read. This is internal material for the firm. No client emails, no client letters, no text addressed to the client.
- Never invent a fact. No reference numbers, case numbers, prices, dates, deadlines, phone numbers, addresses, statutory citations, or people's names unless they appear in what you were given. If a piece of information is needed and you were not given it, that belongs in "openPoints", not in the body.
- Never claim anything has been done in the world. You have not called anyone, booked anything, submitted anything, or paid anything.
- Never commit the firm or the client to a cost, a date, or an obligation.
- Never recommend which option to choose where the choice is the professional's judgement. Lay the options out and say what separates them.

Write at most 3 sections, and aim for about ten lines in total across all of them. Fewer is better. Each section is a heading of a few words and the material under it. Use short lines and simple lists where the material is a list; a numbered or dashed list is fine inside the body.

"summary" is one line saying what now exists that did not before. Do not restate the task title, which the professional is already looking at. Say what you produced.

"openPoints" is everything you could not settle: the specific facts you would need, each one written as the thing to find out, not as an apology. Five at most. An empty list is allowed, and correct, when you genuinely settled everything.

Write plainly, the way one colleague writes to another. No em dashes, no en dashes, no exclamation marks, no filler openers, no closing pleasantries.`;

const SCHEMA = {
  type: "object",
  properties: {
    summary: { type: "string" },
    sections: {
      type: "array",
      items: {
        type: "object",
        properties: {
          heading: { type: "string" },
          body: { type: "string" },
        },
        required: ["heading", "body"],
      },
    },
    openPoints: { type: "array", items: { type: "string" } },
  },
  /* Every field named, because a field left out of `required` comes back
     missing often enough to be the norm rather than the exception. The plan
     drafter lost whole step lists to exactly this. */
  required: ["summary", "sections", "openPoints"],
} as const;

/** One thing the task says it needs before it can start. */
type Input = {
  label: string;
  from?: string | null;
  why?: string | null;
  alreadyHeld?: boolean | null;
};

export async function draftAutoTask({
  title,
  description,
  rationale,
  expectedOutput,
  steps,
  requiredInputs,
  streamName,
  planName,
  clientName,
  requestOutcome,
  workspaceId,
}: {
  title: string;
  description?: string | null;
  rationale?: string | null;
  /** What the task is supposed to produce. The closest thing to a brief. */
  expectedOutput?: string | null;
  steps?: string[];
  requiredInputs?: Input[];
  streamName?: string | null;
  planName?: string | null;
  clientName?: string | null;
  requestOutcome?: string | null;
  workspaceId?: string | null;
}): Promise<AiResult<AutoDraft | null>> {
  /* What the firm has not got yet is said out loud, so the model writes
     around the gap instead of filling it. Without this line it reads a
     requirement as a fact it has been handed. */
  const missing = (requiredInputs ?? [])
    .filter((row) => row.alreadyHeld !== true)
    .map((row) => `- ${row.label}${row.why ? ` (needed for: ${row.why})` : ""}`);

  const held = (requiredInputs ?? [])
    .filter((row) => row.alreadyHeld === true)
    .map((row) => `- ${row.label}`);

  const context = [
    planName ? `Work plan: ${planName}` : null,
    streamName ? `Work stream: ${streamName}` : null,
    clientName ? `Client: ${clientName}` : "Internal work, no client.",
    requestOutcome ? `What the whole request is for: ${requestOutcome}` : null,
    "",
    `The task: ${title}`,
    description ? `\nWhat it involves:\n${description}` : null,
    rationale ? `\nWhy it is on the plan:\n${rationale}` : null,
    expectedOutput ? `\nWhat it is meant to produce:\n${expectedOutput}` : null,
    steps && steps.length > 0
      ? `\nThe steps already written for it:\n${steps.map((s) => `- ${s}`).join("\n")}`
      : null,
    held.length > 0 ? `\nThe firm already holds:\n${held.join("\n")}` : null,
    missing.length > 0
      ? `\nNot in hand yet. Do not write as though you have these, and do not invent their contents:\n${missing.join("\n")}`
      : null,
  ]
    .filter((line) => line !== null)
    .join("\n");

  const result = await generateJson<AutoDraft>({
    system: SYSTEM,
    prompt: context,
    schema: SCHEMA,
    /* Longer than the question drafter's twenty seconds, because this writes
       real material rather than four sentences, and nobody is waiting on it:
       it runs after the plan has been adopted and the screen has gone. */
    signal: AbortSignal.timeout(60_000),
    workspaceId: workspaceId ?? undefined,
    feature: "auto_task_draft",
  });

  if (!result.ok) return result;

  return { ok: true, data: tidy(result.data), usage: result.usage };
}
