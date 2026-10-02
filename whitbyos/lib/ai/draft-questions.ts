import { generateJson } from "@/whitbyos/lib/ai/provider";
import type { AiResult } from "@/whitbyos/lib/ai/provider";
import { tidy } from "@/whitbyos/lib/ai/question-guard";

/**
 * What Whitby needs to know before it drafts.
 *
 * Build with Whitby read a description and went straight to a plan. What it
 * could not do was say "I do not know enough yet": the ambiguity it noticed
 * came back afterwards, as `missing_info` considerations hanging off a plan
 * already built around a guess. A plan built on the wrong assumption is not
 * a plan with a note on it; it is the wrong plan, and every date under it is
 * wrong too.
 *
 * So the description is read once, cheaply, and turned into a short list of
 * questions — and the hard part of this feature is not asking them. It is
 * not asking.
 *
 * Three rules do that work, and they are in the prompt rather than here:
 * nothing already answered in the description, nothing that could be asked
 * of any piece of work, and nothing whose answer would not change the plan.
 * A question that fails any of those is worse than no question, because it
 * teaches somebody that this screen is a toll gate to be clicked through.
 * An empty list is a good outcome and the caller goes straight to drafting.
 */
export type DraftedQuestion = {
  /** The question itself, as one plain sentence ending in a question mark. */
  question: string;
  /**
   * Why the plan needs it, shown quietly beside the question.
   *
   * The screen asks a professional to stop and type, which is a cost. This
   * is the only thing on it that says what the cost buys, and it is what
   * separates a clarifying question from a form field.
   */
  why?: string | null;
  /**
   * Answers worth offering as chips, where the answer is a choice rather
   * than prose. Left empty for anything open.
   */
  options?: string[] | null;
};

export type DraftedQuestions = {
  /** Empty when the description already says enough. That is allowed. */
  questions: DraftedQuestion[];
};

const SYSTEM = `You read a description of professional work and decide what you still need to know before you could plan it properly.

You are not filling in a form. You are the person who will do the work, reading the brief once and writing down what you would have to go back and ask.

Ask at most 4 questions. Ask 0 if the description already says enough — that is a normal outcome, not a failure, and an empty list is better than a weak question.

Never ask:
- anything the description already answers, even loosely or in passing. Read it for facts, not for keywords: a description that says "getting married in Lahore" has answered where, and "Which city should the venue be in?" is that question asked again. The word you are about to use does not have to appear in the description for the description to have answered you
- two things in one question, where the description answers one of them. Splitting is not the fix; drop the half that is answered and ask only what is left
- the exact figure or exact date for something the description already bounds or approximates. "Passports valid past 2032" settles whether they cover the stay; asking for each expiry date is asking again for precision the plan does not need
- anything the Request already records, where one is given. It was written by the same professional and counts the same as the description
- anything listed above as already settled, in any wording. If the deadline is given, do not ask when the work is due, when it should start, or when anybody needs to arrive
- anything you could ask about any piece of work at all ("what is the budget", "who is the point of contact", "when is the deadline") unless the description makes that specific thing genuinely load-bearing and leaves it out
- anything whose answer would not change the plan you write
- for information the professional would have to ask their own client for later anyway; that belongs in the plan as a requirement, not here
- more than one question about the same thing worded two ways

Each question must be answerable in a sentence or a date or a choice. Never ask somebody to write an essay.

Write "why" as the consequence for the plan, in one short clause: what you would get wrong without it. Not "to help me understand" — say what changes. If you cannot name what changes, the question should not be asked.

Give "options" only where the answer really is a small closed set, four at most, each one a short phrase. Leave it empty for anything open. Never invent an example answer: a plausible wrong one sitting in an empty box is the guessing this whole step exists to stop.

Write plainly, in the second person, the way one professional speaks to another. No em dashes, no en dashes, no exclamation marks, no filler openers.`;

const SCHEMA = {
  type: "object",
  properties: {
    questions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          question: { type: "string" },
          why: { type: "string" },
          options: { type: "array", items: { type: "string" } },
        },
        required: ["question", "why"],
      },
    },
  },
  required: ["questions"],
} as const;

export async function draftQuestions({
  description,
  requestTitle,
  clientName,
  targetDate,
  requestOutcome,
  requestDefinitionOfDone,
  workspaceId,
}: {
  description: string;
  requestTitle?: string | null;
  clientName?: string | null;
  /**
   * The deadline from the step before, where one was given.
   *
   * Without it the first thing the model asks is when the work is due,
   * which is the one field on that screen with a date picker on it. Worse
   * than a wasted question: the answer contradicts the field, the plan
   * schedules against the field and writes the answer into its outcome,
   * and it ends up disagreeing with itself in front of a client.
   */
  targetDate?: string | null;
  /**
   * What the Request this plan hangs off already records.
   *
   * A plan built on an existing Request is built on everything that
   * Request says, and the professional wrote that too. Asking about it is
   * the same fault as asking for the deadline the form above carried.
   */
  requestOutcome?: string | null;
  requestDefinitionOfDone?: string | null;
  workspaceId?: string | null;
}): Promise<AiResult<DraftedQuestions>> {
  const context = [
    clientName ? `Client: ${clientName}` : "Internal work, no client.",
    requestTitle ? `Request: ${requestTitle}` : null,
    targetDate
      ? `Already settled, do not ask about it: the work is due ${targetDate}.`
      : null,
    "",
    "The work, as the professional described it:",
    description,
    requestOutcome ? `\nWhat the Request says it is for:\n${requestOutcome}` : null,
    requestDefinitionOfDone
      ? `\nWhat the Request says finished looks like:\n${requestDefinitionOfDone}`
      : null,
  ]
    .filter((line) => line !== null)
    .join("\n");

  const result = await generateJson<DraftedQuestions>({
    system: SYSTEM,
    prompt: context,
    schema: SCHEMA,
    /* Short, and it stands between somebody and the thing they asked for.
       Longer than this and skipping the step is the right call, which the
       caller makes when this comes back not ok. */
    signal: AbortSignal.timeout(20_000),
    workspaceId: workspaceId ?? undefined,
    feature: "work_plan_questions",
  });

  if (!result.ok) return result;

  return {
    ok: true,
    /* The guard is told what the form already settled, because the prompt
       saying so has twice not been enough: told the deadline, the model
       stops asking for it and starts asking whether it is fixed. */
    data: { questions: tidy(result.data?.questions, { hasTargetDate: Boolean(targetDate) }) },
    usage: result.usage,
  };
}
