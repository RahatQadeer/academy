import { generateJson } from "@/whitbyos/lib/ai/provider";
import type { AiResult } from "@/whitbyos/lib/ai/provider";
import { tidy } from "@/whitbyos/lib/ai/proposal-guard";
import type { DraftedProposal } from "@/whitbyos/lib/ai/proposal-guard";
import { needSlug } from "@/whitbyos/lib/plan-requirements";

export type { DraftedProposal } from "@/whitbyos/lib/ai/proposal-guard";

/**
 * The firm's own first version, for the half of a client's list it can draft.
 *
 * Every client-facing ask this product has ever sent was a label and an empty
 * box. That is the right question for a passport and the wrong one for a
 * wedding menu: the menu is the client's to decide and the firm's to draft,
 * and sending it blank is handing the work back to the person paying for it.
 *
 * So the needs marked `proposable` get a first version, and go out as
 * something to approve or change rather than something to write.
 *
 * One call for the whole list rather than one per need. A menu and a running
 * order for the same wedding have to agree with each other, and two separate
 * calls have no way to.
 *
 * Nothing here is sent by writing it. It is stored on the plan, read on the
 * firm's own screen, and reaches the client through the same button that has
 * always sent the ask. SRS 12.1.5.
 */
const SYSTEM = `You work at a professional firm that coordinates complex personal work for clients. For each item below, write the firm's suggested first version, which the client will then approve or change.

Write the thing itself. Not a description of it, not a plan for writing it, not an offer to write it. If the item is a menu, write the menu. If it is a running order, write the running order. If it is a shortlist, write the list with what separates the options.

The label usually names the approval rather than the thing being approved, because it was written for a checklist. Draft the thing. "Family approval of the running order" means write the running order. "Family selection of the menu option" means write the menu options. "Client sign off on the shortlist" means write the shortlist. The word approval, selection, confirmation or sign off in a label is never what you draft.

Never write a restatement of the question. "Not yet set", "Not yet chosen", "What is needed:", "To be confirmed with the family", and any sentence explaining what the client has to provide are all the blank box this exists to replace, with more words in it. If you find yourself writing about the item instead of writing the item, you have the wrong answer.

You may not know enough to be right, and that is fine. A first version is a starting point the client corrects, not a finished decision, and a plausible draft they can strike through is worth more to them than an empty box.

A blank in square brackets is for a fact only the client holds: a person's name, a time they choose, a number only they know. It is never for the content you were asked to draft. A menu names dishes. A shortlist names places. A running order names what happens. If a line of your answer is nothing but blanks, you have written a template, and a template is the empty box again with brackets in it.

Never write "[to be confirmed]", "[TBC]" or "[to be decided]" inside a blank. A blank already says it is theirs to fill.

Where you have been told something is settled, it is settled. Do not put it in brackets and do not ask for it again.

The client reads this exactly as you write it, in a form field under the question it answers. So:

- Never write about the firm's own arrangements. No deadlines, no "the work is due", no internal scheduling, no mention of the plan or the file. The client is reading about their own event, not about how we keep track of it.
- No greeting, no sign off, no covering sentence. Do not begin "Here is", "Below is", "I have drafted" or "Based on". Start with the content.
- No invented facts about this client. Use only what you were told. You do not know their budget, their guest count, their dietary requirements, their family's names, or their preferences unless it is written below.
- Where something genuinely has to be chosen and you were given no basis for choosing, offer two or three clear options with one line each on what separates them, rather than picking one and presenting it as decided. A suggestion the client can choose between is useful. A guess presented as a recommendation is not.
- Never commit to a price, a date, a booking or an obligation. Where a cost or a date belongs, write what it depends on instead.
- Never write anything that only the client could know as though you knew it.

Keep it short enough to read on a phone. A list is a list, one item per line. Plain English, the way a good assistant writes: no salesmanship, no adjectives doing work the content should do.

Echo each item's label back exactly as it is written below, so the suggestion can be matched to its question.

No em dashes, no en dashes, no exclamation marks.

Return an empty list for any item you cannot honestly draft anything for. That is a normal outcome and better than filling the box.`;

const SCHEMA = {
  type: "object",
  properties: {
    proposals: {
      type: "array",
      items: {
        type: "object",
        properties: {
          label: { type: "string" },
          text: { type: "string" },
        },
        required: ["label", "text"],
      },
    },
  },
  required: ["proposals"],
} as const;

type Need = {
  label: string;
  why?: string | null;
  /** The tasks waiting on it, which say what the suggestion is for. */
  neededBy?: string[];
};

export async function draftProposals({
  needs,
  planName,
  clientName,
  requestOutcome,
  requestDetail,
  targetDate,
  workspaceId,
}: {
  needs: Need[];
  planName?: string | null;
  clientName?: string | null;
  requestOutcome?: string | null;
  /** What the professional originally described, where the plan kept it. */
  requestDetail?: string | null;
  /**
   * The plan's deadline, where it has one.
   *
   * Not passed at first, and the first suggestion that came back opened
   * "Date: [date to be confirmed]" on a plan whose date was on the form. The
   * clarifying questions made exactly this mistake a day earlier, for
   * exactly this reason: a fact the product holds and does not hand over is
   * a fact the model asks for.
   */
  targetDate?: string | null;
  workspaceId?: string | null;
}): Promise<AiResult<DraftedProposal[]>> {
  if (needs.length === 0) return { ok: true, data: [] };

  const context = [
    planName ? `Work plan: ${planName}` : null,
    clientName ? `Client: ${clientName}` : null,
    requestOutcome ? `What the work is for: ${requestOutcome}` : null,
    /* Phrased as a fact about the wedding rather than about "the work",
       because whatever this line says the model will quote back into a box
       the client reads. The first wording came out the other side as
       "(the work is due 2027-03-28)", which is the firm's own filing
       language shown to the person paying the bill. */
    targetDate
      ? `This is settled and already agreed with the client: ${targetDate}. Use it as a known date where a date belongs. Never put it in brackets, never ask for it, and never mention deadlines, due dates or scheduling in what you write.`
      : null,
    requestDetail ? `\nWhat the professional described:\n${requestDetail}` : null,
    "",
    "Draft a suggested first version for each of these:",
    ...needs.map((need) =>
      [
        `- ${need.label}`,
        need.why ? `  what it is for: ${need.why}` : null,
        need.neededBy && need.neededBy.length > 0
          ? `  waiting on it: ${need.neededBy.join("; ")}`
          : null,
      ]
        .filter(Boolean)
        .join("\n"),
    ),
  ]
    .filter((line) => line !== null)
    .join("\n");

  const result = await generateJson<{ proposals: DraftedProposal[] }>({
    system: SYSTEM,
    prompt: context,
    schema: SCHEMA,
    /* Generous: this writes several pieces of real content in one call, and
       nobody is waiting on it. It runs from a button and fills in behind. */
    signal: AbortSignal.timeout(90_000),
    workspaceId: workspaceId ?? undefined,
    feature: "client_ask_proposal",
  });

  if (!result.ok) return result;

  /* `needSlug` is the same function that decides two spellings of a label are
     one need everywhere else, so matching here cannot drift from matching
     there. */
  return { ok: true, data: tidy(result.data?.proposals, needSlug), usage: result.usage };
}
