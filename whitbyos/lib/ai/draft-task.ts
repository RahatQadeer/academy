import { generateJson, researchGroundedWithState } from "@/whitbyos/lib/ai/provider";
import type {
  DraftedRequirement,
  DraftedResource,
} from "@/whitbyos/lib/ai/draft-workplan";

/**
 * Everything a task needs to be worked through, for one task added by hand.
 *
 * Drafting a whole plan writes all of this for every task it invents: the
 * steps, what has to be in hand before they can start, what exists afterwards,
 * where to go, and the kind of outside firm it takes. A task added on the
 * Tasks screen had a title and a date, which on a screen showing only work
 * somebody can work through is not work.
 *
 * The same shapes the plan drafter writes, so everything downstream reads one
 * thing: the plan's "What we need from the client" panel gathers
 * `required_inputs` from every task on it and cannot tell which of them a
 * person typed.
 *
 * It searches first, the same as the plan's drafter: a grounded lookup for the
 * offices, official pages and deadlines this task actually touches, then the
 * drafting on top of what came back. Only where that lookup worked is a phone
 * number or an address allowed to stand as `verified`; where it did not, the
 * contact details are stripped and what is left says "Check before use" on the
 * screen. A plausible phone number is worse than none: it gets dialled.
 */
export type DraftedTask = {
  description: string;
  expectedOutput: string;
  estimatedDays: number | null;
  steps: { text: string }[];
  requiredInputs: DraftedRequirement[];
  resources: DraftedResource[];
  providerNeed: {
    category: string;
    why: string;
    /**
     * Firms the search actually turned up, where the directory has nobody.
     *
     * "Find a document attestation agent in Lagos" is a category, not a lead:
     * it leaves the professional doing the searching this already did. These
     * are named candidates with a way to reach them, and they are suggestions
     * rather than providers — nobody here has screened them, and the screen
     * says so.
     */
    suggestions: { name: string; note: string; url: string | null; phone: string | null }[];
  } | null;
  /** A provider from the firm's own directory the model picked, by name. */
  useProvider: string | null;
  /** Whether the web lookup behind it ran, so a screen can say if it did not. */
  researchState: "ok" | "empty" | "failed" | "skipped";
};

const SCHEMA = {
  type: "object",
  properties: {
    description: { type: "string" },
    expectedOutput: { type: "string" },
    estimatedDays: { type: "number" },
    steps: {
      type: "array",
      items: {
        type: "object",
        properties: { text: { type: "string" } },
        required: ["text"],
      },
    },
    requiredInputs: {
      type: "array",
      items: {
        type: "object",
        properties: {
          kind: {
            type: "string",
            enum: ["document", "information", "approval", "account", "contact"],
          },
          label: { type: "string" },
          from: { type: "string", enum: ["client", "firm", "third_party"] },
          why: { type: "string" },
          where: {
            type: "string",
            enum: ["client_portal", "by_post", "in_person", "elsewhere"],
          },
          proposable: { type: "boolean" },
        },
        required: ["kind", "label", "from", "why", "where", "proposable"],
      },
    },
    resources: {
      type: "array",
      items: {
        type: "object",
        properties: {
          kind: {
            type: "string",
            enum: ["website", "booking", "authority", "provider", "emergency", "contact"],
          },
          label: { type: "string" },
          url: { type: "string" },
          phone: { type: "string" },
          address: { type: "string" },
        },
        required: ["kind", "label"],
      },
    },
    providerNeeded: {
      type: "object",
      properties: {
        category: { type: "string" },
        why: { type: "string" },
        useProvider: { type: "string" },
        suggestions: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              note: { type: "string" },
              url: { type: "string" },
              phone: { type: "string" },
            },
            required: ["name", "note"],
          },
        },
      },
      required: ["category", "why", "useProvider", "suggestions"],
    },
  },
  required: [
    "description",
    "expectedOutput",
    "estimatedDays",
    "steps",
    "requiredInputs",
    "resources",
    "providerNeeded",
  ],
} as const;

const SYSTEM = `You work out how one task in a private client firm's work plan actually gets done.

Write in plain, operational language for a professional audience. No marketing tone, no filler. Never use an em dash or an en dash; use a comma, a full stop, or the word you mean.

- "description", one or two sentences saying what the task is.
- "expectedOutput", what exists afterwards that did not before.
- "estimatedDays", working days the task itself takes. Be honest: waiting on a third party is not one day because the email takes a minute.
- "steps", three to seven short instructions in the order somebody works through them. Each one an action a person can finish and tick off: "Download form VAF1A from GOV.UK", not "handle the paperwork". Write for the person doing the work, not as a summary of it. A task that is genuinely one action needs one line; do not pad it.
- "requiredInputs", the documents, information, approvals, accounts or contacts needed before it can start. Say what each is, and set "from" to who it has to come from. "client" is what only the client can hand over, their passport, their decision on an option you put to them. "firm" is what the firm holds or arranges itself. "third_party" is what somebody outside both has to issue, a police certificate, an embassy appointment. Get this right: the client is asked, in one message, for everything marked "client", and asking them for a firm account wastes the one ask you get. Each one also carries "why", what the work needs it for, written for the person being asked rather than for the file — "required for the visa application", not "input to this task", and never a restatement of the label. And "where" it is handed over: "client_portal" for anything that can be uploaded, typed or answered, which is nearly everything; "by_post" for an original that has to be posted or brought in; "in_person" where somebody has to attend somewhere themselves; "elsewhere" where it goes straight to somebody outside this firm. And "proposable": whether this firm could put a first version to the client instead of asking them to produce it from nothing. True for a choice, a plan, a list, a preference or a form of words the firm could draft and the client could then approve or change: a menu, a shortlist, an itinerary, a schedule, suggested wording. False where only the client can be the source: a passport, a bank statement, a signature, a fact only they know. Anything the client physically holds is never proposable, and neither is anything you would have to guess at. An empty list is the right answer where the task needs nothing to begin. Where Knowledge Base articles in the prompt already settle a fact or say the firm holds something, do not ask for it again.
- "resources", the offices, official pages or booking systems somebody has to reach. Where the search below returned a page, a number or an address, use exactly what it returned. Never invent one: an address nobody checked is worse than no address, because somebody drives to it. Leave "url", "phone" and "address" out where the search did not give you them.
- "providerNeeded", where the task needs an outside firm. Most tasks need nobody: for those, write an empty "category", an empty "why" and an empty "useProvider". Where one is needed and the firm's own providers listed below include a fit, put its name in "useProvider" exactly as written there, because they have been screened and somebody here already has their number. Where none of them fits, leave "useProvider" empty, describe in "category" the kind of firm to go and find, and put in "suggestions" the firms the search below actually named, with a line each on why they fit and whatever way to reach them it returned. Only firms the search named: a made-up agency with a made-up number is worse than an empty list, because somebody will ring it. Where it named none, leave "suggestions" empty.

When the prompt includes Knowledge Base articles, prefer their process and facts over inventing either.`;

export async function draftTask(input: {
  title: string;
  stream: string | null;
  plan: string | null;
  request: string | null;
  /**
   * The firm's own providers, so a task that needs one is matched to somebody
   * already screened rather than sending the professional off to find a firm
   * they may already have. Only those worth offering: a provider whose record
   * says nothing about what it does cannot be matched to anything.
   */
  providers?: { name: string; category: string | null; specialty: string | null; location: string | null }[];
  /**
   * Relevant Knowledge Base articles, already rendered by
   * `knowledgeContextLines`.
   */
  knowledgeContext?: string | null;
  workspaceId?: string;
}): Promise<DraftedTask | null> {
  const context = [
    input.plan ? `Work Plan: ${input.plan}` : null,
    input.stream ? `Work Stream: ${input.stream}` : null,
    input.request ? `Client's request: ${input.request}` : null,
    input.knowledgeContext ?? null,
  ]
    .filter(Boolean)
    .join("\n");

  /*
   * The web first, the same as a plan's drafter.
   *
   * Never fatal, and never retried into the ground: a lookup that will not
   * answer leaves the task drafted from what the model already knows, with
   * every address stripped and the page saying so. The timeout leaves room for
   * the two retries inside `researchGrounded`, since a refused call comes back
   * in about five seconds and the next usually answers.
   */
  const lookup = await researchGroundedWithState({
    prompt: [
      `Task: ${input.title}`,
      context,
      "Find the practical externals somebody would need to do this: the official authority or department, the page where an application or appointment is actually made, published contact details for the offices involved, and anything with a fixed deadline or processing time.",
      "Only what you can actually find. Say plainly where you could not find something.",
    ]
      .filter(Boolean)
      .join("\n"),
    signal: AbortSignal.timeout(35_000),
    workspaceId: input.workspaceId,
    feature: "task-research",
  });

  const found = lookup.answer;

  const offered = (input.providers ?? []).filter((provider) =>
    Boolean(provider.category || provider.specialty || provider.location),
  );

  const result = await generateJson<{
    description?: string;
    expectedOutput?: string;
    estimatedDays?: number;
    steps?: { text?: string }[];
    requiredInputs?: DraftedRequirement[];
    resources?: DraftedResource[];
    providerNeeded?: {
      category?: string;
      why?: string;
      useProvider?: string;
      suggestions?: { name?: string; note?: string; url?: string; phone?: string }[];
    };
  }>({
    system: SYSTEM,
    prompt: [
      `Task: ${input.title}`,
      context,
      found?.text ? `\nWhat a search of the web returned:\n${found.text}` : null,
      found?.sources.length
        ? `Sources:\n${found.sources.map((source) => `${source.title}: ${source.url}`).join("\n")}`
        : null,
      offered.length > 0
        ? `\nThis firm's own providers:\n${offered
            .map((provider) =>
              [provider.name, provider.specialty, provider.category, provider.location]
                .filter(Boolean)
                .join(" · "),
            )
            .join("\n")}`
        : null,
    ]
      .filter(Boolean)
      .join("\n")
      .trim(),
    schema: SCHEMA as unknown as Record<string, unknown>,
    workspaceId: input.workspaceId,
    feature: "task-detail",
  });

  // Never fatal. A task that reaches the screen with nothing on it can still
  // be opened, renamed and worked through; one that failed to be created
  // because a model was busy is a task that does not exist.
  if (!result.ok) return null;

  const drafted = result.data;
  const category = drafted.providerNeeded?.category?.trim() ?? "";
  const searched = lookup.state === "ok";

  return {
    description: (drafted.description ?? "").trim(),
    expectedOutput: (drafted.expectedOutput ?? "").trim(),
    estimatedDays:
      typeof drafted.estimatedDays === "number" && drafted.estimatedDays > 0
        ? Math.round(drafted.estimatedDays)
        : null,
    steps: (drafted.steps ?? [])
      .map((step) => ({ text: String(step?.text ?? "").trim() }))
      .filter((step) => step.text.length > 0)
      .slice(0, 7),
    requiredInputs: (drafted.requiredInputs ?? []).filter((input) =>
      Boolean(input?.label?.trim()),
    ),
    /*
     * Marked verified only where a search actually ran and returned something.
     *
     * A model asked for an office's number will produce one whether or not it
     * knows it, and the number will be dialled. Where the lookup did not work,
     * the contact details go and what is left is marked unverified, which the
     * screen draws as "Check before use".
     */
    resources: (drafted.resources ?? [])
      .filter((resource) => Boolean(resource?.label?.trim()))
      .map((resource) => ({
        kind: resource.kind,
        label: resource.label,
        url: resource.url?.trim() || null,
        phone: searched ? resource.phone?.trim() || null : null,
        email: null,
        address: searched ? resource.address?.trim() || null : null,
        verified: searched,
      })),
    providerNeed: category
      ? {
          category,
          why: drafted.providerNeeded?.why?.trim() ?? "",
          // Only where a search actually ran. Without one these are a model's
          // recollection of firms, which is how an invented agency with an
          // invented number reaches somebody's phone.
          suggestions: searched
            ? (drafted.providerNeeded?.suggestions ?? [])
                .filter((one) => Boolean(one?.name?.trim()))
                .slice(0, 4)
                .map((one) => ({
                  name: one.name!.trim(),
                  note: one.note?.trim() ?? "",
                  url: one.url?.trim() || null,
                  phone: one.phone?.trim() || null,
                }))
            : [],
        }
      : null,
    useProvider: drafted.providerNeeded?.useProvider?.trim() || null,
    researchState: lookup.state,
  };
}
