import { generateJson, researchGroundedWithState, type AiResult } from "@/whitbyos/lib/ai/provider";
import { sizeInstruction, trimNote, trimPlan } from "@/whitbyos/lib/ai/plan-size";

/**
 * What the plan says when the lookup never happened.
 *
 * Exported because two places need the same sentence: the drafter writes it,
 * and "Look it up again" closes it when a later search succeeds. Written
 * twice they drift, and a plan that has since reached the web goes on saying
 * it could not.
 */
export const WEB_UNREACHED =
  "Whitby could not reach the web to look this work up, so any office, booking page or contact detail below is from the model's own knowledge and none of it is verified. Use \u201cLook it up again\u201d on the plan to try once more.";

/** A thing a step needs before it can start, and whether the firm has it. */
export type DraftedRequirement = {
  kind: "document" | "information" | "approval" | "account" | "contact";
  label: string;
  /** Null when the model cannot tell from what it was given. */
  alreadyHeld?: boolean | null;
  /**
   * Who this has to come from.
   *
   * Without it the screen cannot tell a passport, which only the client can
   * hand over, from a registrar account, which only the firm can hold. Asking
   * a client for the second is asking for something they have no way to give,
   * and a list that mixes the two is a list nobody can act on.
   *
   * Absent on plans drafted before this existed; the reader falls back rather
   * than guessing here.
   */
  from?: "client" | "firm" | "third_party" | null;
  /**
   * Why the work needs it, in the client's own terms.
   *
   * A list of nouns — "Passport copy", "Proof of address", "Bank statements" —
   * reads as paperwork for its own sake, and the question that comes back is
   * always the same one: what do you need this for? Written for the person
   * being asked, so "required for the visa application", not "input to step 4".
   *
   * Absent on plans drafted before this existed. The screens say nothing
   * rather than inventing a reason.
   */
  why?: string | null;
  /**
   * Where it is handed over.
   *
   * Not a free sentence, because the model does not know this product and a
   * plausible place is worse than none — it sends somebody looking for a
   * screen that does not exist. Four answers, and the words the client reads
   * are written on our side (`needPlaceText`).
   *
   * Nearly everything is `client_portal`: that is where the ask lands, as a
   * form. The other three are for what genuinely cannot be uploaded — an
   * original that must be posted, an appointment somebody has to attend, a
   * thing handed to a third party directly.
   */
  where?: "client_portal" | "by_post" | "in_person" | "elsewhere" | null;
  /**
   * Whether the firm could put a first version to the client, rather than
   * asking them to produce it from nothing.
   *
   * The two kinds of client-facing ask look identical in this list and are
   * nothing alike. A passport can only come from the client. A wedding menu
   * is also theirs to decide, but sending them a blank box labelled "Menu"
   * is the firm handing its own work back: somebody here could draft one and
   * ask them to change what they do not like.
   *
   * True marks the second kind, and those go out as something to approve or
   * edit. Absent on plans drafted before this existed, which reads as false:
   * an old plan keeps asking the way it always did.
   */
  proposable?: boolean | null;
};

/**
 * Somewhere to go or somebody to reach, for a step that leaves the product.
 *
 * `verified` is the whole point of the field. A plausible phone number is
 * worse than none: it gets dialled. Only what a grounded search actually
 * returned is marked true, and everything else says plainly that it has not
 * been checked.
 */
export type DraftedResource = {
  kind: "website" | "booking" | "authority" | "provider" | "emergency" | "contact";
  label: string;
  url?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  verified?: boolean;
};

export type DraftedStep = {
  name: string;
  kind: "auto" | "approval" | "manual";
  /** What the step is, in a sentence or two. */
  description?: string;
  /** Why it is in the plan — what makes a generated plan reviewable. */
  rationale?: string;
  /** Working days the step itself takes. The scheduler turns these into dates. */
  estimatedDays?: number;
  /**
   * The step that must finish first, named exactly as written elsewhere in
   * this plan. Ids do not exist at drafting time, so titles are the only
   * handle — `saveDraftedPlan` matches them up and drops any that miss.
   */
  dependsOn?: string;
  requiredInputs?: DraftedRequirement[];
  /** What exists afterwards that did not before. */
  expectedOutput?: string;
  /** How to actually do it: the steps somebody works through, in order. */
  steps?: { text: string; role?: string }[];
  resources?: DraftedResource[];
  /**
   * Who should do it, as a role rather than a person: the model has never met
   * the team. `lib/assign.ts` matches the role to a member, or flags it.
   */
  assigneeRole?: "owner" | "admin" | "team_lead" | "coordinator" | "billing" | "any";
  /** A provider is needed and the workspace may not have one on file. */
  providerNeeded?: {
    category: string;
    why: string;
    /**
     * The name of a provider the firm already has, copied exactly from the
     * list it was shown. Empty where none of them fit and `category` is a
     * description of who to go and find.
     */
    useProvider?: string;
  };
  /**
   * When this step is due, as whole days from the day the plan is drafted.
   *
   * An offset rather than a date, because the model is poor at arithmetic on
   * calendars and good at sequencing: "this comes about three weeks in" is a
   * judgement it can make, "2026-09-16" is one it gets wrong. The plan's own
   * target date turns the offsets back into dates.
   */
  dueOffsetDays?: number;
  /**
   * Set only when refining — what this step is compared with the plan before
   * it. Screen 3.2.2 writes it beside the step ("· merged", "· new"), which
   * only Whitby can say: two steps folded into one and a step reworded look
   * identical from outside.
   */
  change?: "new" | "merged" | "reworded";
};

export type DraftedStream = {
  name: string;
  purpose: string;
  steps: DraftedStep[];
};

/** SRS §6.6 — a single point of failure, and what happens if it fails. */
export type DraftedRisk = {
  /** The Work Stream it belongs to, by name, for the same reason steps are. */
  workStream?: string;
  risk: string;
  impact: string;
  mitigation: string;
  backupPlan?: string;
  /** What tells you it is happening. */
  trigger?: string;
};

/**
 * SRS §6.8 — something to notice, not something done.
 *
 * `workStream` names the stream it belongs to rather than pointing at an id,
 * because at drafting time none of them have been saved yet. Whoever writes the
 * plan matches the name up afterwards.
 */
export type DraftedConsideration = {
  type:
    | "missing_info"
    | "dependency_conflict"
    | "stale_info"
    | "risk_backup_gap"
    | "calendar_conflict"
    | "requirement_prompt"
    | "next_action";
  body: string;
  workStream?: string;
  /**
   * Where to go to deal with it, for the ones Whitby raises itself.
   *
   * Never from the model: a link it invented would be a link to nowhere. Only
   * the considerations written in this file, which know where they point.
   */
  action?: { href: string; label: string };
};

export type DraftedPlan = {
  /**
   * Whether the web lookup behind this draft actually happened.
   *
   * Kept so the plan can say so afterwards: a plan with no phone numbers on it
   * looks exactly like work that needed none, and only this tells them apart.
   */
  researchState?: "ok" | "empty" | "failed" | "skipped";
  planName: string;
  desiredOutcome: string;
  definitionOfDone: string;
  workStreams: DraftedStream[];
  considerations: DraftedConsideration[];
  risks?: DraftedRisk[];
};

/**
 * SRS §12.1.2 — Whitby drafts or adapts the Workplan for the professional to
 * approve or edit. It proposes; it never commits.
 *
 * §1.15 draws the line the prompt has to respect: Whitby may create reversible
 * internal work on its own, but anything that reaches a client, spends money,
 * makes a commitment or exercises professional judgement needs a human first.
 * That is exactly what `kind` records, so the model is asked to classify every
 * step and told to prefer caution.
 */
const SYSTEM = `You draft coordination plans for a private-client services firm, family offices, relocations, estate matters, household staffing.

A plan has two levels.

Work Streams are the major components of the work, 2 to 5 of them. "Research & Planning", "Execution & Enrollment", "Housing", "Travel and Arrival". Order them the way the work actually has to happen. A Work Stream is never a single action.

Steps are the concrete actions inside a Work Stream, 2 to 5 each. "Research top international schools near the client's London address". "Draft comparison summary for client review". Each one is something a person or the system can actually do and then be finished with.

Classify every step with a kind:
- "auto", organising, researching, summarising or drafting internal material. Reversible, nothing leaves the firm.
- "approval", produces something a client sees, or a decision, commitment, spend or recommendation. A person must review it first.
- "manual", the professional does it themselves: calls, visits, negotiations, relationships.

The kind is about that one step, not the component around it. "Housing Search" is neither auto nor manual; "draft the shortlist" is. When a step is borderline, choose the more cautious kind. Never mark anything "auto" if a client would see the result.

Write in plain, operational language for a professional audience. No marketing tone, no filler. A Work Stream's purpose is one short sentence saying what that component must achieve.

Never use an em dash or an en dash, anywhere, including in the plan's name. Where you would reach for one, use a comma, a full stop, or the word you actually mean. "Toronto Relocation Plan, Khan Family" rather than "Toronto Relocation Plan \u2014 Khan Family".

Every step also carries what somebody needs in order to actually do it:

- "description", one or two sentences saying what the step is.
- "rationale", why it is in the plan. A plan nobody can check is a plan taken on faith.
- "estimatedDays", working days the step itself takes. Be honest: waiting on a third party is not one day because the email takes a minute.
- "dependsOn", the one step that must finish first, written exactly as you named it elsewhere in this plan. Write an empty string where the step can start on its own. Those are what let work run in parallel, and marking everything as dependent makes a plan that cannot be compressed. Do not point a step at itself, and do not point two steps at each other.
- "requiredInputs", the documents, information, approvals, accounts or contacts the step needs before it can start. Say what each is; set "alreadyHeld" only where you were actually told the firm has it — including by the Knowledge Base articles in the prompt. An empty list is the right answer where the step needs nothing to begin.
  Each one also carries "why": what the work needs it for, written for the person being asked rather than for the file. "Required for the visa application" or "the consulate will not book an appointment without it", not "input to step 4". One short line, and never a restatement of the label: "Passport copy is needed because we need a copy of the passport" tells nobody anything.
  And "where": where it is handed over. Write "client_portal" for anything that can be uploaded, typed or answered — that is nearly everything, and it is where we ask. Use "by_post" only for an original that has to be posted or brought in, "in_person" only where somebody has to attend somewhere themselves, such as biometrics or a signing, and "elsewhere" where it goes straight to somebody outside this firm.
  Each one also carries "proposable": whether this firm could put a first version to the client instead of asking them to produce it from nothing.
  Write true where the thing is a choice, a plan, a list, a preference, a structure or a form of words that the firm could draft and the client could then approve or change: a menu, a shortlist, an itinerary, a schedule, a budget breakdown, a running order, suggested wording, a recommended option.
  Write false where only the client can be the source: a passport, a bank statement, a birth certificate, their own account login, a signature, a personal identifier, a fact only they know such as a date or a previous address.
  Anything the client physically holds is never proposable. Neither is anything you would have to guess at: proposing is putting the firm's own work forward for approval, not putting a guess in front of somebody and asking them to confirm it.
  Get this right, because it decides what the client is sent. A blank box for something we could have drafted is the firm handing its work back to the person paying for it. A suggestion for something only they hold is worse: it is a guess wearing a suggestion's clothes.
  Each one also carries "from": who it has to come from. "client" is what only the client can hand over, their passport, their salary history, their decision on an option you put to them. "firm" is what the firm holds or arranges itself, its own accounts, its own templates, its own staff's sign off. "third_party" is what somebody outside both has to issue, a police certificate, a bank letter, an embassy appointment. Get this right: the client is asked, in one message, for everything marked "client", and asking them for a firm account or an embassy slot wastes the one ask you get.
- "expectedOutput", what exists afterwards that did not before.
- "steps", how to actually do it: three to seven short instructions in the order somebody works through them. Each one an action a person can finish and tick off, such as "Download form VAF1A from GOV.UK", not "handle the paperwork". This is what somebody opens the task to read, so write it for the person doing the work, not as a summary of it. A step that is only one action needs only one line.
  Each step also carries a "role": the kind of person who does that particular step. Most of the time it is the same as the task's own "assigneeRole", so write "same" for those. Use a different role where the step genuinely needs somebody else: an approval the owner cannot give themselves, a payment that goes through billing, a call the relationship owner has to make, a form somebody has to sit and fill in while another person chases the appointment.
  This is how a task becomes more than one person's work, and a long task can be three or four people's. Do not force it: a task somebody does start to finish should say "same" on every step. But a task of six or seven steps spanning a fortnight rarely is, and splitting it says which part is whose instead of leaving whoever picks it up to guess.
- "assigneeRole", the kind of person who should do it, not a name. Choose it from what the step actually is:
  - "owner" is the principal's own work: a commitment made on the firm's behalf, a fee agreed, a recommendation put to the client, anything signed. An owner is not a supervisor to be given the leftovers, and a plan where the owner does nothing is a plan nobody senior has touched.
  - "team_lead" is running a component: chasing a third party, judging whether something is good enough, deciding what happens next inside the work.
  - "coordinator" is arranging and gathering: bookings, collecting documents, filling forms, keeping a list current.
  - "billing" is money leaving or arriving: fees, invoices, official payments.
  - "admin" is the firm's own records and systems.
  Spread them the way the work actually divides. A plan whose every step says "coordinator" is not a plan, it is one word repeated, and it ends with one person holding the whole engagement while everybody else holds nothing. Look at each step on its own and ask who in a firm would actually do that, and the roles will vary because the work does.
- "providerNeeded", where the step needs an outside firm. Most steps need nobody: for those, write an empty "category", an empty "why" and an empty "useProvider". Where a step does need one and the firm's own providers listed below include a fit, put its name in "useProvider" exactly as written there, because they have been screened and somebody here has their number. Where none of them fits, leave "useProvider" empty and describe in "category" the kind of firm to go and find.
- "resources", where to go: an official website, a booking page, an authority, an emergency service. An empty list is the right answer where the step is internal and sends nobody anywhere.

Do not calculate dates. Give durations and order; the dates are worked out afterwards.

Answer every one of those for every step. Where the honest answer is "nothing", the empty string and the empty list are the answers. Never invent a sentence to fill the field.

On resources, one rule above all others: never invent a phone number, an email address, a URL or an address. A plausible contact detail is worse than none, because it gets dialled. Give a resource without contact details rather than a resource with invented ones, and mark "verified" true only where you genuinely have the detail from a reliable source.

Then, where the plan has a single point of failure, raise a risk: what could go wrong, what it would cost, what reduces the chance, and what to do instead if it happens anyway.

Then raise 2 to 5 Considerations: things the professional should notice about this plan, which the plan itself does not resolve. A Consideration is never a task and never a change to the plan, it is a gap, a conflict, a risk or a useful next move, for a person to decide about.

- "missing_info", something not confirmed that the work depends on. "The housing budget for the London placement has not been set."
- "dependency_conflict", two parts of the plan whose timing cannot both hold. "The school application deadline falls before the housing decision date."
- "risk_backup_gap", a single point of failure with no fallback. "No backup transport is identified for the embassy visit."
- "calendar_conflict", something likely to clash with a date already committed.
- "requirement_prompt", a rule, document or permission this kind of work usually needs.
- "next_action", the one thing most worth doing first.

Raise them about this plan and this client's situation. Never invent a fact, say what has not been established rather than asserting something has. Where a Consideration is about one component, name that Work Stream exactly as you wrote it above.

When the prompt includes Knowledge Base articles, treat them as the firm's own standards and known facts for this work. Prefer their process over inventing one. Do not raise missing_info for a fact they already settle, and do not ask the client again for information they already cover.`;

const SCHEMA = {
  type: "object",
  properties: {
    planName: { type: "string" },
    desiredOutcome: { type: "string" },
    definitionOfDone: { type: "string" },
    considerations: {
      type: "array",
      items: {
        type: "object",
        properties: {
          type: {
            type: "string",
            enum: [
              "missing_info",
              "dependency_conflict",
              "stale_info",
              "risk_backup_gap",
              "calendar_conflict",
              "requirement_prompt",
              "next_action",
            ],
          },
          body: { type: "string" },
          workStream: { type: "string" },
        },
        required: ["type", "body"],
      },
    },
    workStreams: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          purpose: { type: "string" },
          steps: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                kind: { type: "string", enum: ["auto", "approval", "manual"] },
                dueOffsetDays: { type: "integer" },
                change: { type: "string", enum: ["new", "merged", "reworded"] },
                description: { type: "string" },
                rationale: { type: "string" },
                estimatedDays: { type: "number" },
                dependsOn: { type: "string" },
                expectedOutput: { type: "string" },
                steps: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      text: { type: "string" },
                      role: {
                        type: "string",
                        enum: [
                          "same",
                          "owner",
                          "admin",
                          "team_lead",
                          "coordinator",
                          "billing",
                        ],
                      },
                    },
                    required: ["text", "role"],
                  },
                },
                assigneeRole: {
                  type: "string",
                  enum: ["owner", "admin", "team_lead", "coordinator", "billing", "any"],
                },
                providerNeeded: {
                  type: "object",
                  properties: {
                    category: { type: "string" },
                    why: { type: "string" },
                    useProvider: { type: "string" },
                  },
                  required: ["category", "why", "useProvider"],
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
                      alreadyHeld: { type: "boolean" },
                      from: {
                        type: "string",
                        enum: ["client", "firm", "third_party"],
                      },
                      why: { type: "string" },
                      where: {
                        type: "string",
                        enum: ["client_portal", "by_post", "in_person", "elsewhere"],
                      },
                      proposable: { type: "boolean" },
                    },
                    // `why` and `where` are required for the same reason
                    // `from` is: a field the model may leave out is a field it
                    // does leave out, and half a list explaining itself is
                    // worse than none. `proposable` joins them: left optional
                    // it comes back missing, and every ask goes out blank
                    // again, which is the thing this field exists to stop.
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
                        enum: [
                          "website",
                          "booking",
                          "authority",
                          "provider",
                          "emergency",
                          "contact",
                        ],
                      },
                      label: { type: "string" },
                      url: { type: "string" },
                      phone: { type: "string" },
                      email: { type: "string" },
                      address: { type: "string" },
                      verified: { type: "boolean" },
                    },
                    required: ["kind", "label", "verified"],
                  },
                },
              },
              /**
               * Everything the product actually reads.
               *
               * Under `responseSchema` Gemini fills the required properties
               * and skips the optional ones — on the first real plan drafted
               * through this, all fifteen steps came back with `description`,
               * `rationale`, `estimatedDays`, `dependsOn`, `expectedOutput`,
               * `requiredInputs` and `resources` all absent, which left every
               * task a one-day island and every date the deadline itself.
               *
               * So a field the scheduler or the task briefing depends on is
               * required, and the ones that are legitimately empty some of the
               * time say so in a value the model can write: "" for no
               * predecessor, [] for nothing needed, and an empty "category"
               * for a step that needs nobody outside.
               *
               * `providerNeeded` was left optional on the reasoning that
               * requiring an object invites naming a firm where none is
               * wanted. What actually happened is the third instance of the
               * same bug in this file: on a long plan the optional field is
               * the first thing dropped to fit, so an event needing an AV
               * supplier, a photographer and a chauffeur recorded none of
               * them. It is required, and empty is a thing it can say.
               */
              required: [
                "name",
                "kind",
                "dueOffsetDays",
                "description",
                "rationale",
                "estimatedDays",
                "dependsOn",
                "expectedOutput",
                "steps",
                "assigneeRole",
                "requiredInputs",
                "resources",
                "providerNeeded",
              ],
            },
          },
        },
        required: ["name", "purpose", "steps"],
      },
    },
    risks: {
      type: "array",
      items: {
        type: "object",
        properties: {
          workStream: { type: "string" },
          risk: { type: "string" },
          impact: { type: "string" },
          mitigation: { type: "string" },
          backupPlan: { type: "string" },
          trigger: { type: "string" },
        },
        required: ["risk", "impact", "mitigation"],
      },
    },
  },
  required: [
    "planName",
    "desiredOutcome",
    "definitionOfDone",
    "workStreams",
    "considerations",
    "risks",
  ],
};

export async function draftWorkplan({
  requestTitle,
  description,
  clientName,
  workTypes = [],
  currentSteps,
  instruction,
  shape,
  size,
  targetDate,
  emailContext,
  knowledgeContext,
  providers = [],
  research = true,
  workspaceId,
}: {
  requestTitle: string;
  description: string;
  clientName: string;
  workTypes?: string[];
  /** Screen 3.2.1 — the plan being refined, so Whitby edits rather than restarts. */
  currentSteps?: DraftedStream[];
  /** What the professional asked to change, in their own words. */
  instruction?: string;
  /** WP.4's dials. Left off for a refinement, which keeps the plan's shape. */
  shape?: { urgency: string; complexity: string; size: string };
  /**
   * How big the plan may be, where there are no dials to read it from.
   *
   * WP.4's Configure step is one of three ways a plan gets drafted. The other
   * two, a Request drafted from its own page and a Request created from a
   * prompt, have no such screen and were passing no shape at all, so they
   * were drafted with no limit in the prompt and no cut afterwards. They pass
   * "standard" now, which is the same answer the Configure step starts on.
   *
   * Still absent on a refinement, which is the one case that must not be
   * re-cut: somebody has already edited that plan.
   */
  size?: string | null;
  /** yyyy-mm-dd. How much calendar the steps have to be spread across. */
  targetDate?: string;
  /**
   * What connected Gmail has learned about this client, already rendered by
   * `gmailContextLines`.
   *
   * Passed in rather than fetched here, because this module has no database
   * and should not grow one — everything else it needs arrives the same way.
   * The caller is what knows which client is being drafted for, and that is
   * also the scope the reader enforces.
   */
  emailContext?: string | null;
  /**
   * Relevant Knowledge Base articles, already rendered by
   * `knowledgeContextLines`. Same pattern as email: fetched by the caller,
   * scoped to the client (or firm) being drafted for.
   */
  knowledgeContext?: string | null;
  /**
   * Look the work up on the web before drafting it.
   *
   * On for a first draft, off for a refinement: refining is the professional
   * saying what to change about a plan that already exists, and going back to
   * the web would quietly rewrite parts they did not ask about.
   */
  /**
   * The firm's own directory, so a step that needs an outside firm can name
   * one the firm already trusts instead of describing a category. Contact
   * details are deliberately not included — the model picks a name and the
   * number is read from the record afterwards.
   */
  providers?: { name: string; category: string | null; specialty: string | null; location: string | null; readiness: string }[];
  research?: boolean;
  /**
   * Whose workspace this is being drafted for, so the cost is counted.
   *
   * Drafting is the most expensive thing this product does — a grounded
   * search and then one or two long structured calls — and none of it was
   * metered: neither `generateJson` here nor the search above was given a
   * workspace, so every token of it was billed to nobody. Optional so the
   * drafter still runs where there is genuinely no workspace, and the
   * meter simply has nothing to file it under.
   */
  workspaceId?: string;
}): Promise<AiResult<DraftedPlan>> {
  /**
   * A grounded pass before the drafting one.
   *
   * The drafter is told never to invent a URL or a phone number, which leaves
   * it with nothing to offer unless something goes and finds them. This is that
   * something — the only call in the product allowed out to the open web — and
   * what it returns becomes context rather than answer: the plan is still
   * written by the drafting call, against facts it did not make up.
   *
   * Never fatal. A plan without external links is a smaller plan, not a broken
   * one, so a failed or unconfigured search simply drafts without it.
   */
  // A refinement is the professional saying what to change about a plan that
  // already exists. Going back to the web there would quietly rewrite parts
  // they did not ask about, so the flag is overruled rather than trusted.
  const lookup = research && !instruction
    ? await researchGroundedWithState({
        prompt: [
          `Work: ${requestTitle}`,
          description ? `Detail: ${description}` : null,
          `Find the practical externals somebody would need to do this: the official authority or department, the page where an application or appointment is actually made, published contact details for the offices involved, and anything with a fixed deadline or processing time.`,
          `Only what you can actually find. Say plainly where you could not find something.`,
        ]
          .filter(Boolean)
          .join("\n"),
        // Room for the two retries inside researchGrounded: a refused call
        // comes back in about five seconds and the next usually answers.
        /* Room for three attempts of twenty seconds and the waits between
           them, because a real grounded query against this key takes about
           sixteen. At 35 the third attempt could not finish even when the
           first two had failed quickly. */
        signal: AbortSignal.timeout(70_000),
        workspaceId,
        feature: "work_plan_research",
      })
    : { state: "skipped" as const, answer: null };

  const found = lookup.answer;
  const context = [
    `Client: ${clientName}`,
    `Request: ${requestTitle}`,
    description ? `What they need: ${description}` : null,
    workTypes.length > 0
      ? `This firm coordinates: ${workTypes.join(", ")}`
      : null,
    // WP.4's dials, turned into instructions rather than passed as labels — a
    // model told "complexity: complex" does nothing useful with it.
    shape ? shapeInstruction(shape) : size ? sizeInstruction(size) : null,
    datesInstruction(targetDate),
    // Before the current plan and before the instruction: this is background
    // about the client and the firm, and the two below are about the work.
    emailContext ?? null,
    knowledgeContext ?? null,
    providers.length > 0
      ? `\nProviders this firm already works with. Name one in "useProvider", spelled exactly as here, where it suits a step:\n${providers
          .map((provider) =>
            [
              `- ${provider.name}`,
              provider.category,
              provider.specialty,
              provider.location,
              provider.readiness === "preferred" ? "preferred" : null,
            ]
              .filter(Boolean)
              .join(" · "),
          )
          .join("\n")}`
      : null,
    // What the grounded pass actually found, with its sources, so the drafter
    // can attach a link it did not have to imagine.
    found
      ? `\nLooked up for this work, with the pages it came from:\n${found.text}\n\nSources:\n${found.sources
          .map((source) => `- ${source.title}: ${source.url}`)
          .join("\n")}\n\nUse only these for a resource's url, phone or email. A number, address or link you copy from the findings above is verified, so set "verified" true on it. A resource you add from your own knowledge goes in with no contact details at all and "verified" false. Those two are the only cases: marking a detail you just copied from a source as unverified makes the mark meaningless on the ones that really are.`
      : /*
         * No findings, and the rule about "verified" used to live only in the
         * branch above — so on a plan where the lookup failed, nothing told
         * the model what the mark meant and it wrote `true` on everything it
         * had produced from memory. The mark then said the opposite of the
         * truth on exactly the plans where it mattered most.
         */
        `\nNothing could be looked up for this work, so you have no sources. Every resource you give comes from your own knowledge: set "verified" false on all of them, without exception. Name the authority or the page you believe is right, and do not write a telephone number or an email address at all — a number nobody checked is one somebody dials.`,
    currentSteps?.length
      ? `\nThe current plan is:\n${currentSteps
          .map(
            (stream, i) =>
              `${i + 1}. ${stream.name}, ${stream.purpose}\n` +
              stream.steps
                .map((step) => `   - ${step.name} [${step.kind}]`)
                .join("\n"),
          )
          .join("\n")}`
      : null,
    instruction
      ? `\nThe professional asked: "${instruction}"\nApply exactly that change and return the whole plan. Keep every other step as it was, in the same order and with the same wording. Do not take the opportunity to rewrite anything they did not ask about.\n\nOn every step you touched, set "change": "new" for a step that did not exist, "merged" for one that folds two or more previous steps together, "reworded" for one whose wording you changed. Leave "change" off every step you left alone.`
      : null,
  ]
    .filter(Boolean)
    .join("\n");

  /**
   * Ask again where the answer came back thin.
   *
   * The schema is enforced by Gemini and only described to DeepSeek — its API
   * has no `responseSchema` and nothing holds it to one. So a required field
   * can still be missing: not often, and not because the model is unreliable
   * in general, but often enough that a professional would eventually get a
   * plan whose tasks have no durations and no steps, with nothing anywhere
   * saying the answer was incomplete.
   *
   * Cheaper to ask twice than to save that. One retry, and only where the
   * answer is actually thin rather than merely short — a two-task plan with
   * everything filled in is a fine plan.
   */
  let result = await generateJson<DraftedPlan>({
    system: SYSTEM,
    prompt: context,
    schema: SCHEMA,
    signal: AbortSignal.timeout(45_000),
    workspaceId,
    feature: "work_plan",
  });

  if (result.ok && isThin(result.data)) {
    const again = await generateJson<DraftedPlan>({
      system: SYSTEM,
      prompt: `${context}\n\nAnswer every property the schema requires on every step. The last attempt left some of them out.`,
      schema: SCHEMA,
      signal: AbortSignal.timeout(45_000),
      workspaceId,
      feature: "work_plan",
    });

    // The second answer only if it is better; a worse one is not an
    // improvement just because it is newer.
    if (again.ok && !isThin(again.data)) result = again;
  }

  if (!result.ok) return result;

  /**
   * Nothing was looked up, so nothing can be verified. Not a judgement.
   *
   * The prompt now says this, and a prompt is a request. This is the fact: we
   * know whether a search returned anything, and where it did not, every
   * detail in the answer came out of the model's memory. Telling it to mark
   * them unverified and then trusting the mark is trusting the thing the mark
   * exists to guard against.
   */
  const unsourced = lookup.state !== "ok";

  /**
   * Dashes out, whatever the prompt says.
   *
   * The instruction above is a request. This is the rule: a plan came back
   * named "Toronto Relocation Plan \u2014 Rohail Khan Family", and that dash
   * then appeared in the breadcrumb, the heading, the Ask Whitby panel, the
   * exported PDF and every screen naming the plan. One place to strip it is
   * cheaper than finding it on six.
   */
  const plain = (value: string) =>
    value.replace(/\s*[\u2013\u2014]\s*/g, ", ").replace(/,\s*,/g, ",").trim();

  const workStreams = (result.data.workStreams ?? [])
    .filter((stream) => stream?.name)
    .map((stream) => ({
      ...stream,
      steps: (stream.steps ?? [])
        .filter((step) => step?.name)
        .map((step) => {
          // A refinement did not search, but it did not invent these either:
          // they came through from the draft that did, marks and all.
          if (instruction) return step;

          /**
           * A first draft changes nothing, so "new" / "merged" / "reworded"
           * mean nothing on one and the marker is dropped.
           *
           * Only the marker. This used to rebuild the step as
           * `{ name, kind }`, which threw away the description, the
           * rationale, the duration, the predecessor, the expected output,
           * the required inputs, the assignee role and every resource — on
           * every step of every first draft, before any of it reached the
           * database. It is why plans arrived with no dependencies, no
           * durations, and every task dated on the deadline: the scheduler
           * was handed a list of names.
           */
          const kept = { ...step };
          delete kept.change;
          return unsourced ? withoutSources(kept) : kept;
        }),
    }));

  if (workStreams.length === 0) {
    return {
      ok: false,
      error:
        "Whitby couldn't draft a plan from that. Try describing the outcome in a little more detail.",
    };
  }

  /**
   * A search that was wanted and did not happen is worth saying out loud.
   *
   * The lookup is deliberately never fatal — a plan without external links is
   * a smaller plan, not a broken one. But silent is not the same as harmless:
   * when the grounding quota is exhausted the plan simply stops carrying
   * phone numbers, and from the screen that is indistinguishable from work
   * that needed none. On an urgent plan that is the difference between a
   * number somebody dials and a number nobody knows was missing.
   */
  const considerations = [...(result.data.considerations ?? [])];

  /*
   * Not written as a Consideration.
   *
   * It used to be, and the plan already says the same thing from
   * `researchState` in a banner that carries the button to fix it. Two
   * copies of one fact, one live and one saved, and the saved one went stale
   * the moment a later lookup succeeded: the banner vanished with its button
   * and the row stayed, so the plan warned that nothing was verified and
   * offered no way to clear it.
   *
   * The banner reads live state and cannot drift. `WEB_UNREACHED` survives
   * so the reader can hide the rows already written.
   */
  if (lookup.state === "failed") {
    // Said by the banner, from `researchState`.
  } else if (providers.length > 0 && providers.every((provider) => !described(provider))) {
    /**
     * A directory the drafter cannot read.
     *
     * A provider with no category, no specialty and no location reaches the
     * model as a bare name, and a name alone says nothing about what the firm
     * does — so it is never matched to a step, and the plan asks somebody to
     * go and find a supplier the firm already has.
     *
     * Measured on this: the same provider, described, is named on the step it
     * suits; undescribed, it is named on none.
     */
    considerations.push({
      type: "missing_info",
      body: `Whitby could not match any of your Providers to this work, because none of them record what they do. Add a category or specialty to them and they will be proposed on the steps they suit.`,
      action: { href: "/whitbyos/providers", label: "Open Providers" },
    });
  } else if (isThin(result.data)) {
    /**
     * Said out loud rather than left to be noticed.
     *
     * Two attempts and the answer is still missing durations or steps on most
     * tasks. The plan is kept — the Work Streams and the tasks are real work
     * and throwing them away helps nobody — but a plan whose dates were
     * guessed from nothing must not look like one that was scheduled.
     */
    considerations.push({
      type: "missing_info",
      body:
        "Whitby's answer came back incomplete: some tasks have no duration and no steps, so their dates are placeholders rather than a schedule. Ask Whitby to write the steps for them, or set the dates yourself.",
    });
  } else if (lookup.state === "empty") {
    considerations.push({
      type: "missing_info",
      body:
        "Searching turned up nothing usable for this work, so the offices and pages below are from the model's own knowledge and are unverified. Check any number before dialling it.",
    });
  }

  /*
   * The size somebody chose, made true.
   *
   * Last, after every other consideration is in, so the note about what was
   * cut sits with the rest of what this draft wants to say. `shape` is absent
   * on a refinement, which keeps the plan's existing size rather than
   * re-cutting work somebody has already edited.
   */
  const limit = shape?.size ?? size ?? null;
  const sized = limit
    ? trimPlan<DraftedStep, { workStreams: DraftedStream[] }>({ workStreams }, limit)
    : { plan: { workStreams }, trimmed: { streams: 0, steps: 0 } };

  const cut = limit ? trimNote(sized.trimmed, limit) : null;
  if (cut) {
    /* Said on the plan rather than dropped quietly. A plan missing a third
       of itself with nothing to say so is worse than a long one. */
    considerations.push({ type: "missing_info", body: cut });
  }

  return {
    ok: true,
    data: {
      ...result.data,
      planName: plain(result.data.planName ?? ""),
      workStreams: sized.plan.workStreams,
      considerations,
      researchState: lookup.state,
    },
  };
}


/**
 * A step whose resources admit they came from nobody.
 *
 * Contact details are dropped rather than marked, because a telephone number
 * is not improved by a label: an unverified number still gets dialled, and
 * being told afterwards that nobody checked it is no help to whoever answered.
 * The name of the authority survives, which is the part that is still worth
 * having.
 */
function withoutSources(step: DraftedStep): DraftedStep {
  if (!step.resources?.length) return step;

  return {
    ...step,
    resources: step.resources.map((resource) => ({
      ...resource,
      phone: undefined,
      email: undefined,
      verified: false,
    })),
  };
}

/** Enough for the drafter to know what a provider is for. */
function described(provider: {
  category: string | null;
  specialty: string | null;
  location: string | null;
}): boolean {
  return Boolean(provider.category || provider.specialty || provider.location);
}

/**
 * Whether a drafted plan is missing the things that make it a plan.
 *
 * Not a validator: a step may legitimately have no predecessor, no required
 * inputs and nowhere to send anybody. These two are different. A task with no
 * duration cannot be scheduled, and a task with no steps does not say how the
 * work is done — and when they are missing it is never one or two of them, it
 * is the whole answer, because the field was dropped rather than considered.
 *
 * So: thin if most of the steps are missing either.
 */
function isThin(plan: DraftedPlan): boolean {
  const steps = (plan.workStreams ?? []).flatMap((stream) => stream?.steps ?? []);
  if (steps.length === 0) return false;

  const missing = steps.filter(
    (step) =>
      typeof step?.estimatedDays !== "number" ||
      !Array.isArray(step?.steps) ||
      step.steps.length === 0,
  ).length;

  return missing > steps.length / 2;
}

/**
 * WP.4's urgency, complexity and plan size, as something a model can act on.
 *
 * Each says what to do differently, not what the setting is called. Urgency
 * changes how cautious the classification is, which matters: a rushed plan is
 * exactly when somebody is most tempted to let Whitby send things unreviewed.
 */
/**
 * How the steps get dates.
 *
 * Every step is given one, because a plan where half the work has no date
 * cannot be laid out in time — the Timeline and the burn-down both have
 * nothing to draw, and the professional has to date twelve tasks by hand
 * before either screen says anything.
 *
 * They are proposals. The plan arrives as a draft and every date is editable
 * before it is adopted, which is the point of Review & Edit.
 */
function datesInstruction(targetDate?: string) {
  const span = targetDate ? daysUntil(targetDate) : null;

  const horizon =
    span && span > 0
      ? `The whole plan has to finish within ${span} days. Nothing may be due after that.`
      : `Spread the work across a sensible horizon for this kind of engagement.`;

  return [
    "Give every step a dueOffsetDays: whole days from today, counting today as 0.",
    horizon,
    "Order them so work that unblocks other work falls earlier, and put approvals after the work they approve.",
    "Steps in different Work Streams may overlap, real engagements run in parallel.",
    "Do not give every step the same offset.",
  ].join(" ");
}

function daysUntil(date: string) {
  const target = new Date(`${date}T00:00:00Z`).getTime();
  if (Number.isNaN(target)) return null;
  const today = new Date();
  const start = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  return Math.round((target - start) / 86_400_000);
}

function shapeInstruction(shape: { urgency: string; complexity: string; size: string }) {
  /* One source for the numbers, so the sentence the model reads and the cut
     applied afterwards can never disagree. "Standard" used to say "size it
     to the work", which is an opinion rather than a limit, and plans came
     back with twelve and fifteen tasks whatever anybody chose. */
  const size = sizeInstruction(shape.size);

  const complexity =
    shape.complexity === "simple"
      ? "This is straightforward work with few moving parts. Do not manufacture dependencies between Work Streams that do not exist."
      : shape.complexity === "complex"
        ? "This work has many interacting parts. Order the Work Streams so that what blocks what is obvious from the sequence, and raise a dependency conflict Consideration wherever two parts contend."
        : "This work has the usual number of moving parts.";

  const urgency =
    shape.urgency === "critical" || shape.urgency === "high"
      ? "Time is short. Put the steps that unblock everything else first, and be more cautious with the classification rather than less, a rushed plan is exactly when something reaches a client unreviewed."
      : shape.urgency === "low"
        ? "There is time. Sequence for a good result rather than a fast one."
        : "";

  return [size, complexity, urgency].filter(Boolean).join(" ");
}
