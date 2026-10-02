import "server-only";

import { revalidatePath } from "next/cache";
import { createClient } from "@/base/lib/supabase/server";
import { checkEmail } from "@/base/auth/email";
import { getCurrentWorkspaceId } from "@/whitbyos/lib/workspace";
import { getOpenClient, setOpenClientId } from "@/whitbyos/lib/open-client";
import { setAskThreadClient } from "@/whitbyos/lib/ask-threads";
import { generateJson, isAiConfigured } from "@/whitbyos/lib/ai/provider";
import { draftWorkplan } from "@/whitbyos/lib/ai/draft-workplan";
import { draftTask } from "@/whitbyos/lib/ai/draft-task";
import { saveDraftedPlan } from "@/whitbyos/lib/workplan";
import { listDraftableProviders } from "@/whitbyos/lib/providers";
import { workspaceKnowledgeContext } from "@/whitbyos/lib/knowledge";
import { clientEmailContext } from "@/whitbyos/lib/gmail-context";
import { getWorkTypes } from "@/whitbyos/lib/onboarding";
import { listAssignees } from "@/whitbyos/lib/work-plans";
import { isWorkspaceReadOnly, READ_ONLY_MESSAGE } from "@/whitbyos/lib/read-only";
import { withoutEmDashes } from "@/whitbyos/lib/ask-scope";
import type { Answer, AskPendingAction } from "@/whitbyos/lib/ask";

/**
 * Ask Whitby as an agent — create work, do not only answer questions.
 *
 * SRS §1.15 / §12.1.4: Whitby may create reversible internal work (plans,
 * tasks, clients, requests) without a separate approval step. Material
 * external actions — sending a message to someone — still need an explicit
 * "yes" in the thread before anything leaves.
 *
 * Slot-fill first, then act. Missing name / client / request / assignee is
 * asked in plain English; once the slots are full the row is written and the
 * reply carries an Open link.
 */

type Intent =
  | "create_work_plan"
  | "create_task"
  | "create_client"
  | "create_request"
  | "create_group"
  | "add_person"
  | "send_message"
  | "ask"
  | "cancel";

type Extracted = {
  intent: Intent;
  confirm: "yes" | "no" | "unknown";
  name: string;
  clientName: string;
  /** Exact request title, "none", "new", or empty. */
  requestChoice: string;
  assigneeNames: string[];
  dueDate: string;
  description: string;
  contactName: string;
  contactEmail: string;
  classification: string;
  recipientName: string;
  messageBody: string;
  planName: string;
};

type Named = { id: string; name: string };

const ROUTE = "/[product]/[[...slug]]";

/**
 * After Ask creates (or files work under) a client, make that the open
 * workspace — otherwise the row exists firm-wide but the selected client in
 * the rail still points elsewhere, so lists look empty.
 */
async function focusClientWorkspace(clientId: string, threadId?: string | null) {
  await setOpenClientId(clientId);
  if (threadId) await setAskThreadClient(threadId, clientId);
  revalidatePath(ROUTE, "page");
}

const EXTRACT_SCHEMA = {
  type: "object",
  properties: {
    intent: {
      type: "string",
      enum: [
        "create_work_plan",
        "create_task",
        "create_client",
        "create_request",
        "create_group",
        "add_person",
        "send_message",
        "ask",
        "cancel",
      ],
    },
    confirm: { type: "string", enum: ["yes", "no", "unknown"] },
    name: { type: "string" },
    clientName: { type: "string" },
    requestChoice: { type: "string" },
    assigneeNames: { type: "array", items: { type: "string" } },
    dueDate: { type: "string" },
    description: { type: "string" },
    contactName: { type: "string" },
    contactEmail: { type: "string" },
    classification: { type: "string" },
    recipientName: { type: "string" },
    messageBody: { type: "string" },
    planName: { type: "string" },
  },
  required: [
    "intent",
    "confirm",
    "name",
    "clientName",
    "requestChoice",
    "assigneeNames",
    "dueDate",
    "description",
    "contactName",
    "contactEmail",
    "classification",
    "recipientName",
    "messageBody",
    "planName",
  ],
};

function emptyAnswer(note: string): Answer {
  return { lead: "", sections: [], groups: [], open: null, note, pending: null };
}

function reply(
  lead: string,
  opts?: {
    sections?: Answer["sections"];
    open?: Answer["open"];
    pending?: AskPendingAction | null;
    note?: string | null;
  },
): Answer {
  return {
    lead: withoutEmDashes(lead),
    sections: (opts?.sections ?? []).map((section) => ({
      heading: withoutEmDashes(section.heading),
      bullets: section.bullets.map((b) => withoutEmDashes(b)),
    })),
    groups: [],
    open: opts?.open ?? null,
    note: opts?.note ?? null,
    pending: opts?.pending ?? null,
  };
}

function fold(name: string) {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * How many single-character edits turn one string into the other.
 *
 * Plain Levenshtein, bounded: names are short and this runs over a list of a
 * few dozen, so the two-row table is cheaper than anything cleverer.
 */
function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);

  for (let i = 1; i <= a.length; i += 1) {
    const current = [i];
    for (let j = 1; j <= b.length; j += 1) {
      current[j] = Math.min(
        previous[j]! + 1,
        current[j - 1]! + 1,
        previous[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    previous = current;
  }

  return previous[b.length]!;
}

/**
 * A name somebody typed, matched to a name we hold.
 *
 * Exact first, then contained, then near enough. That last step is the point:
 * people type "Rohial Khan" and "Whitfeild", and being told "I could not
 * match that" because of one transposed letter is the machine being pedantic
 * about its own spelling. One edit is allowed per five characters, so short
 * names stay strict — "Sam" must not quietly become "Pam" — and longer ones
 * forgive a slip or two.
 *
 * Where several names are that close, none of them wins. Guessing between
 * two clients is worse than asking which one.
 */
function matchNamed(list: Named[], raw: string): Named | null {
  const want = fold(raw);
  if (!want) return null;

  const exact = list.find((row) => fold(row.name) === want);
  if (exact) return exact;

  /*
   * Contained, but only where one row contains it.
   *
   * This was a `find`, so with a `Khan Family` and a `Khan Holdings` on the
   * books "for Khan" silently took whichever sorted first — and the summary
   * then said a client's name with enough confidence to be waved through.
   * Two matches is not a near miss, it is a question.
   */
  const contained = list.filter(
    (row) => fold(row.name).includes(want) || want.includes(fold(row.name)),
  );
  if (contained.length === 1) return contained[0]!;
  if (contained.length > 1) return null;

  /* Long enough to be worth forgiving. Under ten characters a single edit
     is most of the word — "Sam" and "Pam" are one apart — so those have to
     be right. */
  if (want.length < 10) return null;
  const slack = Math.max(1, Math.floor(want.length / 5));
  const near = list
    .map((row) => ({ row, off: editDistance(fold(row.name), want) }))
    .filter((hit) => hit.off <= slack)
    .sort((a, b) => a.off - b.off);

  if (near.length === 0) return null;
  // A tie is an ambiguity, and an ambiguity is a question, not a guess.
  if (near.length > 1 && near[0]!.off === near[1]!.off) return null;
  return near[0]!.row;
}

function splitName(full: string): [string, string] {
  const parts = full.trim().split(/\s+/);
  if (parts.length === 1) return [parts[0]!, ""];
  return [parts.slice(0, -1).join(" "), parts.at(-1)!];
}

function inSevenDays() {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return d.toISOString().slice(0, 10);
}

function mergeSlots(
  pending: AskPendingAction | null | undefined,
  extracted: Extracted,
): AskPendingAction["slots"] {
  const prior = pending?.slots ?? {};
  const next = { ...prior };

  const put = (key: keyof AskPendingAction["slots"], value: string | null | undefined) => {
    const v = (value ?? "").trim();
    if (v) next[key] = v;
  };

  put("name", extracted.name);
  put("clientName", extracted.clientName);
  put("requestChoice", extracted.requestChoice);
  put("dueDate", extracted.dueDate);
  put("description", extracted.description);
  put("contactName", extracted.contactName);
  put("contactEmail", extracted.contactEmail);
  put("classification", extracted.classification);
  put("recipientName", extracted.recipientName);
  put("messageBody", extracted.messageBody);
  put("planName", extracted.planName);

  if (extracted.assigneeNames.length > 0) {
    next.assigneeNames = extracted.assigneeNames.join(", ");
  }

  return next;
}

async function extract(
  question: string,
  workspaceId: string,
  ctx: {
    clients: Named[];
    requests: Named[];
    teammates: Named[];
    pending: AskPendingAction | null | undefined;
    prior: { role: "user" | "whitby"; body: string }[];
    openClient: Named | null;
  },
): Promise<Extracted | null> {
  if (!isAiConfigured()) return null;

  const history = ctx.prior
    .slice(-8)
    .map((row) => `${row.role === "whitby" ? "Whitby" : "Professional"}: ${row.body}`)
    .join("\n");

  const pendingLine = ctx.pending
    ? `Pending create in progress: ${ctx.pending.intent}. Slots so far: ${JSON.stringify(ctx.pending.slots)}. awaitingConfirm=${Boolean(ctx.pending.awaitingConfirm)}.`
    : "No pending create.";

  const openLine = ctx.openClient
    ? `Open client on the bar right now: ${ctx.openClient.name}. If they say "open client", "this client", or "current client", put that exact name in clientName.`
    : `No client is open on the bar. If they say "open client", leave clientName empty (do not write none).`;

  const result = await generateJson<Extracted>({
    system: [
      "You are Whitby's create-agent parser for a professional services workspace.",
      "Decide whether the professional wants to CREATE something or just ask a question.",
      "create_work_plan: make a work plan (draft).",
      "create_task: make a task and assign people.",
      "create_client: add a workspace.",
      "create_request: open a request.",
      "create_group: start a group conversation with several people in it. Put the subject in name and every person named in recipientName, separated by commas.",
      "add_person: add a person to a client — a second contact, a spouse, an accountant. Put their name in contactName, their email in contactEmail, and the client in clientName.",
      "send_message: start or send a message to a teammate or client contact.",
      "ask: ordinary Q&A, lookups, summaries. Not a create.",
      "cancel: they changed their mind about the pending create.",
      "If a pending create is in progress and their message is answering your questions, keep that same intent and fill slots.",
      "People type quickly and spell badly. Read past typos, missing capitals and missing apostrophes rather than treating a misspelt word as something you do not recognise: \"wrokplan\" and \"work plna\" are a work plan, \"Rohial Khan\" is Rohail Khan, \"creat a tsak\" is create a task. Put the corrected spelling in the slot, not what they typed.",
      "clientName: exact name from the Clients list, or the open client's name when they said open/current/this client, or the word none only when they clearly want internal work with no client. Never invent. Empty if unknown.",
      "name: a short title for the plan/task/client/request/message subject. Empty if they only said create without naming it. Never copy the whole instruction sentence.",
      "requestChoice: exact request title from the list, or 'none' if they said none/no request, or 'new' if they want a fresh request, else empty.",
      "assigneeNames: teammate names from the list, or 'me' / 'myself' for the current user. Empty if unsaid.",
      "dueDate: yyyy-mm-dd when they gave a date, else empty.",
      "confirm: yes/no only when they are clearly approving or refusing a proposed send/create; else unknown.",
      "Never invent names that are not in the lists or the message. Never use em dashes.",
      "Fill every string field; use empty string or empty array when unknown.",
    ].join(" "),
    prompt: [
      `Clients: ${ctx.clients.map((c) => c.name).join(", ") || "(none)"}`,
      openLine,
      `Open / recent requests: ${ctx.requests.map((r) => r.name).join(", ") || "(none)"}`,
      `Teammates: ${ctx.teammates.map((t) => t.name).join(", ") || "(none)"}`,
      pendingLine,
      history ? `Conversation:\n${history}` : null,
      `Latest message: ${question}`,
    ]
      .filter(Boolean)
      .join("\n\n"),
    schema: EXTRACT_SCHEMA,
    workspaceId,
    feature: "ask",
  });

  if (!result.ok) return null;

  // Normalize "open client" phrases onto the real open client name when we have one.
  const data = result.data;
  if (ctx.openClient && isOpenClientPhrase(data.clientName)) {
    data.clientName = ctx.openClient.name;
  }
  if (!isUsableTitle(data.name)) data.name = "";
  return data;
}

async function loadCatalog(workspaceId: string) {
  const supabase = await createClient();
  const open = await getOpenClient();

  const [{ data: clients }, { data: requests }, teammates] = await Promise.all([
    supabase
      .from("whitbyos_clients")
      .select("id, name")
      .eq("workspace_id", workspaceId)
      .is("archived_at", null)
      .order("name"),
    supabase
      .from("whitbyos_requests")
      .select("id, title, client_id, status")
      .eq("workspace_id", workspaceId)
      .in("status", ["open", "in_progress", "waiting"])
      .order("updated_at", { ascending: false })
      .limit(40),
    listAssignees(),
  ]);

  return {
    supabase,
    openClient: open ? { id: open.id, name: open.name } : null,
    clients: ((clients ?? []) as { id: string; name: string }[]).map((row) => ({
      id: row.id,
      name: row.name,
    })),
    requests: ((requests ?? []) as { id: string; title: string; client_id: string | null }[]).map(
      (row) => ({
        id: row.id,
        name: row.title,
        clientId: row.client_id,
      }),
    ),
    teammates: teammates.map((row) => ({ id: row.id, name: row.name })),
  };
}

/** Same answer the Work Plans wizard uses: None = firm's own work, no client. */
function isNoClient(raw: string | null | undefined) {
  const v = fold(raw ?? "");
  return ["none", "no client", "no", "internal", "n/a", "nobody", "without client"].includes(v);
}

/** "the open client" / "selected client" means whoever is on the bar — not none. */
function isOpenClientPhrase(raw: string | null | undefined) {
  const v = fold(raw ?? "");
  if (!v) return false;
  return (
    v === "open" ||
    v === "open client" ||
    v === "the open client" ||
    v === "current client" ||
    v === "the current client" ||
    v === "selected client" ||
    v === "the selected client" ||
    v === "this client" ||
    v.includes("open client")
  );
}

/**
 * A real plan title — not the whole starter sentence ("Create a work plan for…").
 */
function isUsableTitle(raw: string | null | undefined) {
  const v = (raw ?? "").trim();
  if (!v || v.length < 2) return false;
  const folded = fold(v);
  if (/^(create|make|draft|start|new|build)\b/.test(folded)) return false;
  if (/^work plan\b/.test(folded)) return false;
  if (folded.includes("for the open client")) return false;
  if (folded.includes("assign it to me")) return false;
  return true;
}

/**
 * Resolve a named client, or `"none"` when the professional said internal /
 * no client (allowed on work plans and requests). `null` means still ask.
 */
function resolveClientChoice(
  slots: AskPendingAction["slots"],
  clients: Named[],
  openClient: Named | null,
  opts?: { allowNone?: boolean; preferOpen?: boolean },
): Named | "none" | null {
  // "Open client" is never "none" — use the bar, or ask if nobody is open.
  if (isOpenClientPhrase(slots.clientName)) {
    if (openClient && clients.some((c) => c.id === openClient.id)) return openClient;
    return null;
  }

  if (opts?.allowNone && isNoClient(slots.clientName)) return "none";

  if (slots.clientName && !isNoClient(slots.clientName)) {
    const hit = matchNamed(clients, slots.clientName);
    if (hit) return hit;
    // They named somebody we cannot match — ask again rather than guessing.
    return null;
  }

  if (opts?.preferOpen !== false && openClient && clients.some((c) => c.id === openClient.id)) {
    return openClient;
  }
  if (clients.length === 1) return clients[0]!;
  return null;
}

function askForClient(
  clients: Named[],
  pending: AskPendingAction,
  opts?: { allowNone?: boolean },
): Answer {
  const names = clients.slice(0, 12).map((c) => c.name);
  if (opts?.allowNone) {
    return reply(
      clients.length === 0
        ? 'No clients yet — say "none" for internal work with no client, or give me a client name (and contact + email) to create one first.'
        : `Which client is this for? ${names.join(", ")}${clients.length > 12 ? ", …" : ""}. Or say "none" for internal work with no client.`,
      { pending },
    );
  }
  return reply(
    clients.length === 0
      ? "There are no clients yet. Tell me the workspace name, the primary contact's name and email, and I will create the client first."
      : `Which client is this for? ${names.join(", ")}${clients.length > 12 ? ", …" : ""}.`,
    { pending },
  );
}

/**
 * The last word before anything is written.
 *
 * Only messages used to stop and ask. A plan, a task, a client or a request
 * was created the instant the final slot was filled — which is fine when the
 * model has understood, and is a row somebody has to go and delete when it
 * has not. The professional is the one being asked to remember what they
 * said three turns ago, and what Whitby heard is not always what they meant.
 *
 * So every create now reads its own understanding back and waits for a yes.
 * It costs one turn and it is the difference between a mistake that is
 * corrected in a word and one that is corrected in a screen.
 *
 * Returns the question where one is still needed, and null once the answer
 * has been given.
 */
function confirmFirst(
  pending: AskPendingAction,
  /**
   * Whether the summary was already put to them last turn.
   *
   * Read from the pending that came in, not from the one built here: every
   * handler starts by making a fresh `pending` out of the slots, which
   * carries no flag at all. Checking that one meant the answer was never
   * seen — "yes" produced the same summary again, and again, and the plan
   * was never created no matter how many times somebody agreed to it.
   */
  asked: boolean,
  /**
   * Whether this turn actually said yes.
   *
   * Both halves are needed. The flag alone means "shall I create this?" is
   * answered by anything at all — "hold on", "change the name", a fresh
   * question — because all of those arrive on a turn where it is set.
   */
  confirmed: boolean,
  lead: string,
  lines: string[],
): Answer | null {
  if (asked && confirmed) return null;

  /* Drawn as a list, for the same reason `askAll` is. */
  return reply(`${lead} Say yes and I will create it, or tell me what to change.`, {
    pending: { ...pending, awaitingConfirm: true },
    sections: [{ heading: "About to create", bullets: lines.filter(Boolean) }],
  });
}

/**
 * Everything still missing, in one message.
 *
 * The handlers used to return on the first empty slot, so creating a work
 * plan was four round trips: which client, then what name, then which
 * request, then are you sure. Nobody talks like that. Somebody who already
 * knows all four answers had to be asked for them one at a time, and
 * somebody who knew none of them could not tell what they were in for.
 *
 * Asked together, they can be answered together — in one sentence, in any
 * order, or partly, and whatever is still blank comes back round. A single
 * outstanding question is asked as a question rather than as a list of one.
 */
/** One thing still to be answered, and the choices for it where listing helps. */
type Ask = { q: string; hint?: string; heading?: string; options?: string[] };

function askAll(
  pending: AskPendingAction,
  opener: string,
  asks: Ask[],
): Answer {
  /*
   * One sentence, the way a person would say it.
   *
   * This was a canned opener and a bulleted form: "I can draft that. Answer
   * what you can in one message and I will fill in the rest." followed by
   * numbered questions. It reads as a machine filling in fields, which is
   * what it is and not what it should sound like. Ask ChatGPT to create a
   * work plan and it says "Sure. What would you like to name it, and which
   * client should it be associated with?" — two questions, one breath.
   *
   * So the questions are joined into a sentence, and only the things that
   * genuinely need listing — a dozen client names, the open requests — are
   * drawn underneath where they can be read down. Putting those inline was
   * what made the paragraph unreadable in the first place.
   */
  /*
   * Written as questions, not as clauses.
   *
   * "when it is due" reads fine in the middle of a run — "who should own it
   * and when it is due?" — and is wrong the moment it is the only thing
   * left: "Sure. When it is due?". Proper question order works in both, so
   * that is what they are all written in.
   */
  const questions = asks.map((ask) => ask.q.replace(/\?$/, ""));
  const run =
    questions.length === 1
      ? `${questions[0]}?`
      : `${questions.slice(0, -1).join(", ")} and ${questions.at(-1)}?`;

  // The questions are written lower case so they can be strung together; the
  // one that ends up first still has to start a sentence.
  const joined = run.charAt(0).toUpperCase() + run.slice(1);

  const hints = asks.map((ask) => ask.hint).filter(Boolean).join(" ");

  return reply(`${opener} ${joined}${hints ? ` ${hints}` : ""}`, {
    pending,
    sections: asks
      .filter((ask) => (ask.options?.length ?? 0) > 0)
      .map((ask) => ({ heading: ask.heading ?? "Options", bullets: ask.options! })),
  });
}

/**
 * What is worth doing next, said once the thing exists.
 *
 * A create used to end at "Done." — true, and the end of the conversation.
 * The professional then went and worked out for themselves that a plan with
 * no tasks needs tasks, or that a client with no invitation cannot see
 * anything. Whitby knows both, and knows them at exactly the moment they
 * matter.
 *
 * Suggestions, not steps taken: each one is a sentence they can say back,
 * because everything named here is something this agent can actually do.
 */
function nextSteps(lines: string[]): Answer["sections"] {
  const real = lines.filter(Boolean);
  if (real.length === 0) return [];
  return [{ heading: "You might want to", bullets: real }];
}

async function createWorkPlanFromAsk(input: {
  workspaceId: string;
  userId: string;
  /** Whether the summary was already put to them on the turn before. */
  awaiting: boolean;
  /** Whether this turn said yes to it. */
  confirmed: boolean;
  slots: AskPendingAction["slots"];
  clients: Named[];
  requests: { id: string; name: string; clientId: string | null }[];
  openClient: Named | null;
  prompt: string;
  threadId?: string | null;
}): Promise<Answer> {
  const pending: AskPendingAction = { intent: "create_work_plan", slots: input.slots };

  /*
   * Client is optional — same as Start blank / Configure: "None, internal
   * work". Only ask when nothing is open and they have not said none / a name.
   */
  const clientChoice = resolveClientChoice(input.slots, input.clients, input.openClient, {
    allowNone: true,
    // If they already answered (including "none"), do not re-pick the open client.
    preferOpen: !input.slots.clientName,
  });

  const client = clientChoice && clientChoice !== "none" ? clientChoice : null;
  const clientSlot = clientChoice ? (client ? client.name : "none") : null;

  const name = isUsableTitle(input.slots.name)
    ? (input.slots.name ?? "").trim()
    : isUsableTitle(input.slots.description)
      ? (input.slots.description ?? "").trim().split(/(?<=[.!?])\s/)[0]!.slice(0, 80)
      : "";

  const choice = (input.slots.requestChoice ?? "").trim().toLowerCase();

  /* Every gap at once, rather than four turns of one question each. */
  const asks: Ask[] = [];

  const asksClient = !clientChoice;
  if (asksClient) {
    asks.push({
      q: "who is it for",
      hint:
        input.clients.length === 0
          ? 'There are no clients on file yet, so say "none" for internal work, or give me a name, a contact and an email and I will set one up.'
          : // The request question says "none" too, and saying it twice in one
            // breath reads as a machine repeating its own options.
            choice
            ? 'You can say "none" if it is internal work.'
            : "",
      heading: "Clients",
      options: input.clients.slice(0, 12).map((row) => row.name),
    });
  }

  if (!name) asks.push({ q: "what should I call it" });

  if (!choice) {
    const forClient = client
      ? input.requests.filter((r) => r.clientId === client.id)
      : clientChoice
        ? input.requests.filter((r) => !r.clientId)
        : [];
    asks.push({
      q: "which request should it sit on",
      hint:
        forClient.length > 0
          ? 'Say "new" for a fresh one, or "none" and I will open one named after the plan.'
          : 'Say "none" and I will open one named after the plan.',
      heading: "Open requests",
      options: forClient.slice(0, 8).map((r) => r.name),
    });
  }

  if (asks.length > 0) {
    return askAll(
      {
        ...pending,
        slots: {
          ...input.slots,
          clientName: clientSlot,
          name: name || null,
          requestChoice: choice || null,
        },
      },
      "Sure.",
      asks,
    );
  }

  /* The same guard the task and the request have. Without it "next Friday"
     reached the scheduler, which produced dates from an Invalid Date and
     swallowed the failure — a plan that looked finished with no dates on it
     and nothing saying why. */
  const target = (input.slots.dueDate ?? "").trim();
  if (target && !/^\d{4}-\d{2}-\d{2}$/.test(target)) {
    return reply(
      `I could not read "${target}" as a date. Give me a day as YYYY-MM-DD, or say "no date".`,
      { pending: { ...pending, slots: { ...input.slots, dueDate: null } } },
    );
  }

  const ready = confirmFirst(
    { ...pending, slots: { ...input.slots, clientName: clientSlot, name, requestChoice: choice } },
    input.awaiting,
    input.confirmed,
    "Here is what I will create.",
    [
      `Name: ${name}`,
      `Client: ${client ? client.name : "None, internal work"}`,
      `Request: ${choice === "none" || choice === "new" ? "a new one, named after the plan" : choice}`,
    ],
  );
  if (ready) return ready;

  const supabase = await createClient();
  let requestId: string | null = null;

  if (choice === "none" || choice === "new") {
    const { data: request, error } = await supabase
      .from("whitbyos_requests")
      .insert({
        workspace_id: input.workspaceId,
        client_id: client?.id ?? null,
        title: name,
        desired_outcome: (input.slots.description ?? "").trim() || name,
        status: "open",
        priority: "standard",
        owner_user_id: input.userId,
        /* No client → private; portal has nobody to show it to (startFromScratch). */
        visibility: client ? "client_account" : "private_to_requestor",
      })
      .select("id")
      .single();
    if (error || !request) {
      return reply(`I could not open the request: ${error?.message ?? "unknown error"}.`);
    }
    requestId = request.id as string;
  } else {
    const forClient = client
      ? input.requests.filter((r) => r.clientId === client.id)
      : input.requests.filter((r) => !r.clientId);
    const hit =
      matchNamed(
        forClient.map((r) => ({ id: r.id, name: r.name })),
        input.slots.requestChoice!,
      ) ??
      matchNamed(
        input.requests.map((r) => ({ id: r.id, name: r.name })),
        input.slots.requestChoice!,
      );
    if (!hit) {
      return reply(
        `I could not match that to a request. Try one of: ${forClient
          .slice(0, 8)
          .map((r) => r.name)
          .join("; ")}, or say "new" / "none".`,
        {
          pending: {
            ...pending,
            slots: {
              ...input.slots,
              clientName: clientSlot,
              name,
              requestChoice: null,
            },
          },
        },
      );
    }
    requestId = hit.id;
  }

  const description =
    (input.slots.description ?? "").trim() ||
    input.prompt ||
    name;

  const drafted = await draftWorkplan({
    workspaceId: input.workspaceId,
    providers: await listDraftableProviders(),
    requestTitle: name,
    description,
    clientName: client?.name ?? "internal (no client)",
    workTypes: await getWorkTypes(),
    emailContext: client ? await clientEmailContext(client.id) : null,
    knowledgeContext: await workspaceKnowledgeContext(
      `${name}\n${description}`,
      client?.id ?? null,
    ),
    targetDate: target || undefined,
  });

  if (!drafted.ok) {
    return reply(
      `I opened the request but could not draft the plan yet: ${drafted.error}. Open the request and try Build with Whitby from there.`,
      { open: { label: "Open request →", href: `/whitbyos/requests/${requestId}` } },
    );
  }

  const saved = await saveDraftedPlan({
    requestId: requestId!,
    ownerUserId: input.userId,
    plan: drafted.data,
    name,
    replaceDraft: choice === "none" || choice === "new",
    targetDate: target || null,
  });

  if (!saved.ok) {
    return reply(`Drafting finished but saving failed: ${saved.error}.`, {
      open: { label: "Open request →", href: `/whitbyos/requests/${requestId}` },
    });
  }

  revalidatePath(ROUTE, "page");
  const forWhom = client ? `for ${client.name}` : "as internal work (no client)";
  if (client) await focusClientWorkspace(client.id, input.threadId);
  return reply(`Done. I drafted “${name}” ${forWhom} and saved it as a work plan draft.`, {
    open: { label: "Open work plan →", href: `/whitbyos/work-plans/${saved.workplanId}` },
    sections: [
      {
        heading: "What I used",
        bullets: [
          `Client: ${client ? client.name : "none (internal)"}`,
          `Request: ${choice === "none" || choice === "new" ? `new (“${name}”)` : input.slots.requestChoice}`,
          ...(input.slots.dueDate ? [`Target: ${input.slots.dueDate}`] : []),
        ],
      },
      ...nextSteps([
        input.slots.dueDate
          ? ""
          : "Give it a target date and I will schedule every step backwards from it.",
        `Add a task to it — say "add a task to ${name}".`,
        client
          ? `Ask ${client.name} for what the plan needs from them, on the plan's own panel.`
          : "",
      ]),
    ],
  });
}

async function ensureStreamForTask(input: {
  workspaceId: string;
  userId: string;
  client: Named;
  requestId: string | null;
  planNameHint: string;
  /**
   * The plan the question was asked from, where there is one.
   *
   * Asked from a plan's own panel, "create a task" means a task on *this*
   * plan. Without it the search ran over every stream the client has and,
   * finding nothing it liked, opened a brand new plan called "<Client>
   * plan" with a stream called "Tasks" — so a task asked for on the UK
   * school admissions plan landed in a plan nobody had made, and the screen
   * it was asked from did not change.
   */
  onPlanId?: string | null;
  slots: AskPendingAction["slots"];
}): Promise<{ workstreamId: string; planId: string; planName: string; streamName: string } | Answer> {
  const supabase = await createClient();
  const pending: AskPendingAction = { intent: "create_task", slots: input.slots };

  const query = supabase
    .from("whitbyos_workstreams")
    .select(
      "id, name, workplan_id, plan:whitbyos_workplans!workplan_id (id, name, deleted_at, archived_at, status, request:whitbyos_requests!request_id (id, title, client_id, workspace_id))",
    )
    .limit(80);

  const { data: rows } = await query;

  const usable = ((rows ?? []) as unknown as {
    id: string;
    name: string;
    workplan_id: string;
    plan:
      | {
          id: string;
          name: string;
          deleted_at: string | null;
          archived_at: string | null;
          status: string;
          request:
            | { id: string; title: string; client_id: string | null; workspace_id: string }
            | { id: string; title: string; client_id: string | null; workspace_id: string }[]
            | null;
        }
      | {
          id: string;
          name: string;
          deleted_at: string | null;
          archived_at: string | null;
          status: string;
          request:
            | { id: string; title: string; client_id: string | null; workspace_id: string }
            | { id: string; title: string; client_id: string | null; workspace_id: string }[]
            | null;
        }[]
      | null;
  }[])
    .map((row) => {
      const plan = Array.isArray(row.plan) ? row.plan[0] : row.plan;
      const request = plan
        ? Array.isArray(plan.request)
          ? plan.request[0]
          : plan.request
        : null;
      return { row, plan, request };
    })
    .filter(
      ({ plan, request }) =>
        plan &&
        !plan.deleted_at &&
        !plan.archived_at &&
        request?.workspace_id === input.workspaceId &&
        request.client_id === input.client.id &&
        (!input.requestId || request.id === input.requestId),
    );

  /*
   * The plan it was asked from wins outright.
   *
   * Not a hint among others: somebody looking at a plan and asking for a
   * task has already said which plan. If it has one stream the task goes
   * there; if it has several they are the only ones offered.
   */
  const onPlan = input.onPlanId
    ? usable.filter(({ plan }) => plan!.id === input.onPlanId)
    : [];

  if (onPlan.length === 1) {
    return {
      workstreamId: onPlan[0]!.row.id,
      planId: onPlan[0]!.plan!.id,
      planName: onPlan[0]!.plan!.name,
      streamName: onPlan[0]!.row.name,
    };
  }

  if (onPlan.length > 1) {
    const named = (input.slots.planName ?? "").trim();
    const picked = named
      ? matchNamed(
          onPlan.map(({ row }) => ({ id: row.id, name: row.name })),
          named,
        )
      : null;

    const chosen = picked ? onPlan.find(({ row }) => row.id === picked.id) : null;
    if (chosen) {
      return {
        workstreamId: chosen.row.id,
        planId: chosen.plan!.id,
        planName: chosen.plan!.name,
        streamName: chosen.row.name,
      };
    }

    return reply(
      `Which Work Stream should it go in? ${onPlan.map(({ row }) => row.name).join("; ")}.`,
      {
        pending: {
          ...pending,
          awaitingConfirm: true,
          slots: { ...pending.slots, name: input.slots.name ?? null },
        },
      },
    );
  }

  const planHint = (input.slots.planName ?? input.planNameHint ?? "").trim();
  if (planHint && usable.length > 0) {
    const hit = usable.find(
      ({ plan }) => plan && (fold(plan.name).includes(fold(planHint)) || fold(planHint).includes(fold(plan.name))),
    );
    if (hit?.plan) {
      return {
        workstreamId: hit.row.id,
        planId: hit.plan.id,
        planName: hit.plan.name,
        streamName: hit.row.name,
      };
    }
  }

  if (usable.length === 1 && usable[0]?.plan) {
    return {
      workstreamId: usable[0].row.id,
      planId: usable[0].plan.id,
      planName: usable[0].plan.name,
      streamName: usable[0].row.name,
    };
  }

  if (usable.length > 1) {
    const plans = [...new Map(usable.map((u) => [u.plan!.id, u.plan!.name])).entries()];
    return reply(
      `Which work plan should this task sit on? ${plans
        .slice(0, 10)
        .map(([, name]) => name)
        .join("; ")}.`,
      { pending },
    );
  }

  // No plan yet — open a request (if needed) and a small draft plan with one stream.
  let requestId = input.requestId;
  if (!requestId) {
    const title = (input.slots.name ?? "General work").trim() || "General work";
    const { data: request, error } = await supabase
      .from("whitbyos_requests")
      .insert({
        workspace_id: input.workspaceId,
        client_id: input.client.id,
        title,
        desired_outcome: title,
        status: "open",
        priority: "standard",
        owner_user_id: input.userId,
        visibility: "client_account",
      })
      .select("id")
      .single();
    if (error || !request) {
      return reply(`This client has no work plan yet, and I could not open one: ${error?.message ?? "error"}.`);
    }
    requestId = request.id as string;
  }

  const planTitle =
    (input.slots.planName ?? "").trim() ||
    `${input.client.name} plan`;

  const { data: plan, error: planError } = await supabase
    .from("whitbyos_workplans")
    .insert({
      request_id: requestId,
      name: planTitle,
      status: "draft",
      urgency: "medium",
      health: "on_track",
      owner_user_id: input.userId,
    })
    .select("id")
    .single();

  if (planError || !plan) {
    return reply(`I could not start a work plan for the task: ${planError?.message ?? "error"}.`);
  }

  const { data: stream, error: streamError } = await supabase
    .from("whitbyos_workstreams")
    .insert({
      workplan_id: plan.id,
      name: "Tasks",
      status: "not_started",
      kind: "manual",
      sort_order: 0,
    })
    .select("id, name")
    .single();

  if (streamError || !stream) {
    return reply(`I started a plan but could not add a work stream: ${streamError?.message ?? "error"}.`, {
      open: { label: "Open work plan →", href: `/whitbyos/work-plans/${plan.id}` },
    });
  }

  return {
    workstreamId: stream.id as string,
    planId: plan.id as string,
    planName: planTitle,
    streamName: (stream.name as string) || "Tasks",
  };
}

async function createTaskFromAsk(input: {
  workspaceId: string;
  userId: string;
  /** The plan the panel this was asked from belongs to, if any. */
  onPlanId?: string | null;
  /** The request that plan hangs off, so it is not asked for again. */
  onRequestId?: string | null;
  /** Whether the summary was already put to them on the turn before. */
  awaiting: boolean;
  /** Whether this turn said yes to it. */
  confirmed: boolean;
  slots: AskPendingAction["slots"];
  clients: Named[];
  requests: { id: string; name: string; clientId: string | null }[];
  teammates: Named[];
  openClient: Named | null;
  prompt: string;
  threadId?: string | null;
}): Promise<Answer> {
  const pending: AskPendingAction = { intent: "create_task", slots: input.slots };

  // Tasks still need a client workspace (New Task dialog).
  /*
   * A task belongs to a client, and "none" is not one.
   *
   * With `allowNone: false` a deliberate "none" fell through to the open
   * client, so somebody who answered none got a task filed under whoever
   * happened to be open — the opposite of what they said, with nothing
   * said about it. It is answered rather than overridden.
   */
  if (isNoClient(input.slots.clientName)) {
    return reply(
      "A task has to belong to a client — there is nowhere else to file one. Name the client, or say cancel and I will open a work plan for internal work instead.",
      { pending: { ...pending, slots: { ...input.slots, clientName: null } } },
    );
  }

  /*
   * Asked from a plan, the client and the request are already answered.
   *
   * The panel sits on one plan, which hangs off one request, which belongs
   * to one client — all three are on the screen behind it. Asking "which
   * request is it under" there is the product asking a question it can read
   * off its own page, and offering the other four requests as options is
   * offering to file the task somewhere the person is not looking.
   *
   * The same rule the Work Plan wizard follows for the open client: what
   * has been settled is inherited, not asked again.
   */
  const onRequest = input.onRequestId
    ? input.requests.find((row) => row.id === input.onRequestId) ?? null
    : null;

  const inherited = onRequest?.clientId
    ? input.clients.find((row) => row.id === onRequest.clientId) ?? null
    : null;

  const clientChoice =
    inherited ??
    resolveClientChoice(input.slots, input.clients, input.openClient, {
      allowNone: false,
    });
  const client = clientChoice && clientChoice !== "none" ? clientChoice : null;

  const title =
    (input.slots.name ?? "").trim() ||
    (input.slots.description ?? "").trim().split(/(?<=[.!?])\s/)[0]?.slice(0, 80) ||
    "";

  const forClient = client ? input.requests.filter((r) => r.clientId === client.id) : [];
  let requestId: string | null = null;
  const choice = onRequest ? onRequest.name.toLowerCase() : (input.slots.requestChoice ?? "").trim().toLowerCase();
  const assigneeSoFar = (input.slots.assigneeNames ?? "").trim();

  /* Everything missing, in one message — see `askAll`. */
  const asks: Ask[] = [];

  if (!client) {
    asks.push({
      q: "who is it for",
      hint:
        input.clients.length === 0
          ? "There are no clients on file yet. Give me a name, a contact and an email and I will set one up first."
          : "",
      heading: "Clients",
      options: input.clients.slice(0, 12).map((row) => row.name),
    });
  }

  if (!title) asks.push({ q: "what should it be called" });

  if (!choice && forClient.length > 0) {
    asks.push({
      q: "which request is it under",
      hint: 'Say "none" if it stands on its own.',
      heading: "Open requests",
      options: forClient.slice(0, 8).map((r) => r.name),
    });
  }

  if (!assigneeSoFar) {
    asks.push({
      q: "who should own it",
      hint: 'You can say "me".',
      heading: "Your team",
      options: input.teammates.slice(0, 8).map((row) => row.name),
    });
  }

  if (!(input.slots.dueDate ?? "").trim()) {
    asks.push({
      q: "when is it due",
      hint: `A day as YYYY-MM-DD, or say "in a week" and I will use ${inSevenDays()}.`,
    });
  }

  if (asks.length > 0) {
    return askAll(
      {
        ...pending,
        slots: {
          ...input.slots,
          clientName: client ? client.name : null,
          name: title || null,
          requestChoice: choice || null,
        },
      },
      "Sure.",
      asks,
    );
  }

  /* Nothing is left to ask by here — the block above returns while anything
     is. Said in code as well as in prose, because the compiler reads one. */
  if (!client) return askForClient(input.clients, pending);

  if (choice && choice !== "none") {
    const hit = matchNamed(
      forClient.map((r) => ({ id: r.id, name: r.name })),
      input.slots.requestChoice!,
    );
    if (!hit) {
      return reply(`I could not match that request. Try: ${forClient.map((r) => r.name).join("; ")}, or "none".`, {
        pending: {
          ...pending,
          slots: { ...input.slots, clientName: client.name, name: title, requestChoice: null },
        },
      });
    }
    requestId = hit.id;
  }

  const assigneeRaw = (input.slots.assigneeNames ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);


  const assigneeIds: string[] = [];
  for (const raw of assigneeRaw) {
    if (["me", "myself", "i"].includes(fold(raw))) {
      assigneeIds.push(input.userId);
      continue;
    }
    const hit = matchNamed(input.teammates, raw);
    if (hit) assigneeIds.push(hit.id);
  }
  if (assigneeIds.length === 0) {
    return reply("I could not match those names to teammates. Try again with a name from the team list, or say \"me\".", {
      pending,
    });
  }

  /*
   * A date Postgres will accept, or none at all.
   *
   * Whatever the model put in this slot went straight into `due_date`, so
   * "next Friday" reached the driver and came back to the professional as a
   * raw database error in the middle of a conversation.
   */
  const askedDate = (input.slots.dueDate ?? "").trim();
  if (askedDate && !/^\d{4}-\d{2}-\d{2}$/.test(askedDate)) {
    return reply(
      `I could not read "${askedDate}" as a date. Give me a day as YYYY-MM-DD, or say "in a week" and I will use ${inSevenDays()}.`,
      { pending: { ...pending, slots: { ...input.slots, dueDate: null } } },
    );
  }
  const dueDate = askedDate || inSevenDays();

  const ready = confirmFirst(
    {
      ...pending,
      slots: {
        ...input.slots,
        clientName: client.name,
        name: title,
        dueDate,
        assigneeNames: assigneeRaw.join(", "),
      },
    },
    input.awaiting,
    input.confirmed,
    "Here is the task.",
    [
      `Task: ${title}`,
      `Client: ${client.name}`,
      `Owner: ${assigneeRaw.join(", ")}`,
      `Due: ${dueDate}${askedDate ? "" : " (a week from today, say another date to change it)"}`,
    ],
  );
  if (ready) return ready;

  const streamOrAsk = await ensureStreamForTask({
    workspaceId: input.workspaceId,
    userId: input.userId,
    client,
    requestId,
    onPlanId: input.onPlanId ?? null,
    planNameHint: (input.slots.planName ?? "").trim(),
    slots: {
      ...input.slots,
      clientName: client.name,
      name: title,
      requestChoice: choice || "none",
      assigneeNames: assigneeRaw.join(", "),
      dueDate,
    },
  });

  if ("lead" in streamOrAsk) return streamOrAsk;

  const supabase = await createClient();
  const { data: created, error } = await supabase
    .from("whitbyos_tasks")
    .insert({
      workspace_id: input.workspaceId,
      request_id: requestId,
      client_id: client.id,
      workstream_id: streamOrAsk.workstreamId,
      title,
      owner_user_id: assigneeIds[0]!,
      priority: "medium",
      status: "not_started",
      due_date: dueDate,
      visibility: "internal",
    })
    .select("id")
    .single();

  if (error || !created) {
    return reply(`I could not create the task: ${error?.message ?? "error"}.`);
  }

  await supabase.from("whitbyos_task_assignees").delete().eq("task_id", created.id);
  await supabase.from("whitbyos_task_assignees").insert(
    assigneeIds.map((userId, index) => ({
      task_id: created.id,
      user_id: userId,
      sort_order: index,
    })),
  );

  const directory = await listDraftableProviders();
  const drafted = await draftTask({
    title,
    stream: streamOrAsk.streamName,
    plan: streamOrAsk.planName,
    request: forClient.find((r) => r.id === requestId)?.name ?? null,
    providers: directory,
    knowledgeContext: await workspaceKnowledgeContext(title, client.id),
    workspaceId: input.workspaceId,
  });

  if (drafted) {
    await supabase
      .from("whitbyos_tasks")
      .update({
        description: drafted.description || null,
        expected_output: drafted.expectedOutput || null,
        estimated_days: drafted.estimatedDays,
        required_inputs: drafted.requiredInputs,
        external_links: drafted.resources,
        provider_need: drafted.providerNeed,
        updated_at: new Date().toISOString(),
      })
      .eq("id", created.id);

    if (drafted.steps.length > 0) {
      await supabase.from("whitbyos_checklists").insert({
        task_id: created.id,
        workstream_id: streamOrAsk.workstreamId,
        title: "Steps",
        items: drafted.steps.map((step) => ({
          text: step.text,
          done: false,
          ownerUserId: assigneeIds[0]!,
        })),
      });
    }
  }

  revalidatePath(ROUTE, "page");
  await focusClientWorkspace(client.id, input.threadId);
  const who = assigneeRaw.map((n) => (["me", "myself", "i"].includes(fold(n)) ? "you" : n)).join(", ");
  return reply(`Done. I created “${title}” for ${client.name}, assigned to ${who}, due ${dueDate}.`, {
    open: {
      label: "Open task →",
      href: `/whitbyos/work-plans/${streamOrAsk.planId}/tasks/${created.id}`,
    },
    sections: [
      {
        heading: "Where it sits",
        bullets: [
          `Work plan: ${streamOrAsk.planName}`,
          `Stream: ${streamOrAsk.streamName}`,
          requestId
            ? `Request: ${forClient.find((r) => r.id === requestId)?.name ?? requestId}`
            : "Request: none",
        ],
      },
      ...nextSteps([
        requestId ? "" : "It is not under any request. Say which one and I will file it.",
        `Add another task to ${streamOrAsk.planName}.`,
        `Message ${client.name} about it.`,
      ]),
    ],
  });
}

async function createClientFromAsk(input: {
  workspaceId: string;
  userId: string;
  /** Whether the summary was already put to them on the turn before. */
  awaiting: boolean;
  /** Whether this turn said yes to it. */
  confirmed: boolean;
  slots: AskPendingAction["slots"];
  threadId?: string | null;
}): Promise<Answer> {
  const pending: AskPendingAction = { intent: "create_client", slots: input.slots };
  const name = (input.slots.name ?? "").trim();
  const contactName = (input.slots.contactName ?? "").trim();
  const contactEmail = (input.slots.contactEmail ?? "").trim();
  const classification = (input.slots.classification ?? "").trim() || "family";

  /* All three at once — see `askAll`. */
  const asks: Ask[] = [];
  if (!name) asks.push({ q: "what should it be called" });
  if (!contactName) asks.push({ q: "who is the main person to deal with" });
  if (!contactEmail) asks.push({ q: "what is their email" });
  if (!(input.slots.classification ?? "").trim()) {
    asks.push({
      /* The options move to the hint: a question with its own comma list
         inside it collides with the commas joining the questions together. */
      q: "what kind of client is it",
      hint: "A family, an individual, a company or an organization — leave it out and I will file it as a family. The email is where their portal invitation goes.",
    });
  }

  if (asks.length > 0) {
    return askAll(
      { ...pending, slots: { ...input.slots, name: name || null, contactName: contactName || null } },
      "Sure.",
      asks,
    );
  }

  const checked = checkEmail(contactEmail);
  if (!checked.ok) {
    return reply(`That email does not look usable: ${checked.reason}. Send another address.`, {
      pending: {
        ...pending,
        slots: { ...input.slots, name, contactName, contactEmail: null, classification },
      },
    });
  }

  const guessed = classification.toLowerCase();
  const clientType =
    guessed.includes("compan") || guessed.includes("business")
      ? "company"
      : guessed.includes("individual") || guessed.includes("person")
        ? "individual"
        : guessed.includes("organization") || guessed.includes("org")
          ? "organization"
          : "family";

  const ready = confirmFirst(
    { ...pending, slots: { ...input.slots, name, contactName, contactEmail, classification } },
    input.awaiting,
    input.confirmed,
    "Here is the workspace.",
    [
      `Client: ${name}`,
      `Kind: ${clientType}`,
      `Primary contact: ${contactName}`,
      `Email: ${contactEmail}`,
    ],
  );
  if (ready) return ready;

  const supabase = await createClient();
  const [firstName, lastName] = splitName(contactName);
  const { data: contact, error: contactError } = await supabase
    .from("contacts")
    .insert({
      first_name: firstName,
      last_name: lastName,
      email: contactEmail,
      title_role: name,
      source: "whitby_ask",
      created_by_workspace_id: input.workspaceId,
    })
    .select("id")
    .single();

  if (contactError || !contact) {
    return reply(`I could not create the contact: ${contactError?.message ?? "error"}.`);
  }

  const { data: client, error } = await supabase
    .from("whitbyos_clients")
    .insert({
      workspace_id: input.workspaceId,
      name,
      client_type: clientType,
      classification,
      status: "active",
      owner_user_id: input.userId,
      primary_contact_id: contact.id,
    })
    .select("id")
    .single();

  if (error || !client) {
    return reply(`I could not create the client: ${error?.message ?? "error"}.`);
  }

  await supabase.from("whitbyos_client_members").insert({
    client_id: client.id,
    contact_id: contact.id,
    role: "primary_contact",
    portal_access: false,
  });

  await focusClientWorkspace(client.id as string, input.threadId);
  return reply(
    `Done. I created the workspace “${name}” with ${contactName} as primary contact, and opened it as your selected workspace.`,
    {
      open: { label: `Open ${name} →`, href: `/whitbyos/clients/${client.id}` },
      sections: nextSteps([
        `Invite ${contactName} to the portal — until then they cannot see anything.`,
        `Open the first request for ${name}.`,
        `Draft a work plan for ${name} and I will lay out the steps.`,
      ]),
    },
  );
}

async function createRequestFromAsk(input: {
  workspaceId: string;
  userId: string;
  /** Whether the summary was already put to them on the turn before. */
  awaiting: boolean;
  /** Whether this turn said yes to it. */
  confirmed: boolean;
  slots: AskPendingAction["slots"];
  clients: Named[];
  openClient: Named | null;
  prompt: string;
  threadId?: string | null;
}): Promise<Answer> {
  const pending: AskPendingAction = { intent: "create_request", slots: input.slots };
  const clientChoice = resolveClientChoice(input.slots, input.clients, input.openClient, {
    allowNone: true,
    preferOpen: !input.slots.clientName,
  });
  if (!clientChoice) {
    return askForClient(input.clients, pending, { allowNone: true });
  }

  const client = clientChoice === "none" ? null : clientChoice;
  const clientSlot = client ? client.name : "none";

  const title =
    (input.slots.name ?? "").trim() ||
    (input.slots.description ?? "").trim().split(/(?<=[.!?])\s/)[0]?.slice(0, 80) ||
    "";

  if (!title) {
    return askAll(
      { ...pending, slots: { ...input.slots, clientName: clientSlot } },
      "Sure.",
      [
        { q: "what should it be called" },
        ...((input.slots.dueDate ?? "").trim()
          ? []
          : [{ q: "is there a target date", hint: 'YYYY-MM-DD, or say "no date".' }]),
      ],
    );
  }

  const outcome = (input.slots.description ?? "").trim() || input.prompt || title;

  /* The same guard the task has: an unreadable date must not reach the
     driver and come back as an error string in the middle of a chat. */
  const wanted = (input.slots.dueDate ?? "").trim();
  if (wanted && !/^\d{4}-\d{2}-\d{2}$/.test(wanted)) {
    return reply(
      `I could not read "${wanted}" as a date. Give me a day as YYYY-MM-DD, or say "no date".`,
      { pending: { ...pending, slots: { ...input.slots, dueDate: null } } },
    );
  }

  const ready = confirmFirst(
    { ...pending, slots: { ...input.slots, clientName: clientSlot, name: title, dueDate: wanted } },
    input.awaiting,
    input.confirmed,
    "Here is the request.",
    [
      `Request: ${title}`,
      `Client: ${client ? client.name : "None, internal work"}`,
      wanted ? `Target date: ${wanted}` : "",
    ],
  );
  if (ready) return ready;

  const supabase = await createClient();
  const { data: request, error } = await supabase
    .from("whitbyos_requests")
    .insert({
      workspace_id: input.workspaceId,
      client_id: client?.id ?? null,
      title,
      desired_outcome: outcome,
      status: "open",
      priority: "standard",
      owner_user_id: input.userId,
      visibility: client ? "client_account" : "private_to_requestor",
      target_date: wanted || null,
    })
    .select("id")
    .single();

  if (error || !request) {
    return reply(`I could not open the request: ${error?.message ?? "error"}.`);
  }

  revalidatePath(ROUTE, "page");
  if (client) await focusClientWorkspace(client.id, input.threadId);
  const forWhom = client ? `for ${client.name}` : "as internal work (no client)";
  return reply(`Done. I opened “${title}” ${forWhom}.`, {
    open: { label: "Open request →", href: `/whitbyos/requests/${request.id}` },
    sections: nextSteps([
      `Draft a work plan on it — say "draft a work plan for ${title}".`,
      wanted ? "" : "Give it a target date and everything under it can be scheduled to land.",
      "Add the first task.",
    ]),
  });
}

/**
 * A group conversation, with everybody in it from the start.
 *
 * `sendMessageFromAsk` only ever makes a `direct` thread with one person on
 * it, so there was no way to ask Whitby for the thing people actually want
 * — the family, the two solicitors and the relocation agent in one place.
 *
 * Teammates and client contacts only. Providers are deliberately left out:
 * the Messages screen refuses a group that mixes a client with a provider
 * (`mixesClientAndProvider`), and a rule the rest of the product enforces
 * is not one to go around from here.
 */
async function createGroupFromAsk(input: {
  workspaceId: string;
  userId: string;
  awaiting: boolean;
  confirmed: boolean;
  slots: AskPendingAction["slots"];
  teammates: Named[];
}): Promise<Answer> {
  const pending: AskPendingAction = { intent: "create_group", slots: input.slots };

  const subject = (input.slots.name ?? "").trim();
  const listed = (input.slots.recipientName ?? "")
    .split(/,| and /)
    .map((one) => one.trim())
    .filter(Boolean);

  const asks: Ask[] = [];
  if (!subject) asks.push({ q: "what should the group be called" });
  if (listed.length === 0) {
    asks.push({
      q: "who should be in it",
      hint: "Teammates or client contacts, separated by commas.",
      heading: "Your team",
      options: input.teammates.slice(0, 8).map((row) => row.name),
    });
  }

  if (asks.length > 0) {
    return askAll(
      { ...pending, slots: { ...input.slots, name: subject || null } },
      "Sure.",
      asks,
    );
  }

  const supabase = await createClient();

  /* Contacts are matched by the same rules as a direct message, so a group
     can hold the client's people as well as the firm's. */
  const { data: contactRows } = await supabase
    .from("contacts")
    .select("id, first_name, last_name, preferred_name")
    .eq("created_by_workspace_id", input.workspaceId)
    .limit(200);

  const contacts = ((contactRows ?? []) as {
    id: string;
    first_name?: string | null;
    last_name?: string | null;
    preferred_name?: string | null;
  }[]).map((row) => ({
    id: row.id,
    name:
      row.preferred_name || [row.first_name, row.last_name].filter(Boolean).join(" ") || "Contact",
  }));

  const found: { type: "user" | "contact"; id: string; name: string }[] = [];
  const missed: string[] = [];

  for (const raw of listed) {
    const teammate = matchNamed(input.teammates, raw);
    if (teammate) {
      found.push({ type: "user", id: teammate.id, name: teammate.name });
      continue;
    }
    const contact = matchNamed(contacts, raw);
    if (contact) {
      found.push({ type: "contact", id: contact.id, name: contact.name });
      continue;
    }
    missed.push(raw);
  }

  if (missed.length > 0) {
    return reply(
      `I could not find ${missed.map((one) => `“${one}”`).join(", ")} among teammates or contacts. Check the ${missed.length === 1 ? "name" : "names"} and tell me again who should be in it.`,
      { pending: { ...pending, slots: { ...input.slots, recipientName: null } } },
    );
  }

  const ready = confirmFirst(
    { ...pending, slots: { ...input.slots, name: subject } },
    input.awaiting,
    input.confirmed,
    "Here is the group.",
    [`Called: ${subject}`, `In it: you, ${found.map((one) => one.name).join(", ")}`],
  );
  if (ready) return ready;

  const { data: thread, error } = await supabase
    .from("whitbyos_message_threads")
    .insert({
      workspace_id: input.workspaceId,
      subject,
      kind: "group",
      last_message_at: new Date().toISOString(),
      created_by_user_id: input.userId,
    })
    .select("id")
    .single();

  if (error || !thread) {
    return reply(`I could not start the group: ${error?.message ?? "error"}.`);
  }

  const { error: peopleError } = await supabase.from("whitbyos_message_participants").insert([
    {
      thread_id: thread.id,
      participant_type: "user",
      participant_id: input.userId,
      added_by_user_id: input.userId,
      last_read_at: new Date().toISOString(),
    },
    ...found.map((one) => ({
      thread_id: thread.id,
      participant_type: one.type,
      participant_id: one.id,
      added_by_user_id: input.userId,
    })),
  ]);

  if (peopleError) {
    /* A thread with nobody on it is invisible to everyone and clutter to
       the database, so it is taken back rather than left standing. */
    await supabase.from("whitbyos_message_threads").delete().eq("id", thread.id);
    return reply(`I could not add everybody to the group: ${peopleError.message}.`);
  }

  revalidatePath(ROUTE, "page");
  return reply(`Done. I started “${subject}” with ${found.map((one) => one.name).join(", ")}.`, {
    open: { label: "Open the group →", href: `/whitbyos/messages?thread=${thread.id}` },
    sections: nextSteps([
      `Send the first message in it — say "message ${subject} that we are ready to start".`,
      "Add somebody else to it later from the group's own settings.",
    ]),
  });
}

/**
 * Another person on a client — a spouse, an accountant, a second contact.
 *
 * `create_client` makes exactly one person, the primary contact, and there
 * was no way to add a second. Most client work involves more than one
 * person almost immediately.
 *
 * The contact is made and attached; the portal invitation is not sent from
 * here. Inviting somebody is a separate decision with its own screen, and
 * doing it silently as part of "add Sarah" would let somebody into a
 * client's file without anybody choosing to.
 */
async function addPersonFromAsk(input: {
  workspaceId: string;
  userId: string;
  awaiting: boolean;
  confirmed: boolean;
  slots: AskPendingAction["slots"];
  clients: Named[];
  openClient: Named | null;
  threadId?: string | null;
}): Promise<Answer> {
  const pending: AskPendingAction = { intent: "add_person", slots: input.slots };

  const clientChoice = resolveClientChoice(input.slots, input.clients, input.openClient, {
    allowNone: false,
  });
  const client = clientChoice && clientChoice !== "none" ? clientChoice : null;
  const personName = (input.slots.contactName ?? "").trim();
  const email = (input.slots.contactEmail ?? "").trim();

  const asks: Ask[] = [];
  if (!client) {
    asks.push({
      q: "which client are they for",
      heading: "Clients",
      options: input.clients.slice(0, 12).map((row) => row.name),
    });
  }
  if (!personName) asks.push({ q: "what is their name" });
  if (!email) asks.push({ q: "what is their email" });

  if (asks.length > 0) {
    return askAll(
      {
        ...pending,
        slots: {
          ...input.slots,
          clientName: client ? client.name : null,
          contactName: personName || null,
        },
      },
      "Sure.",
      asks,
    );
  }

  const checked = checkEmail(email);
  if (!checked.ok) {
    return reply(`That email does not look usable: ${checked.reason}. Send another address.`, {
      pending: { ...pending, slots: { ...input.slots, contactEmail: null } },
    });
  }

  const ready = confirmFirst(
    { ...pending, slots: { ...input.slots, clientName: client!.name, contactName: personName } },
    input.awaiting,
    input.confirmed,
    "Here is the person.",
    [`Name: ${personName}`, `Email: ${email}`, `On: ${client!.name}`],
  );
  if (ready) return ready;

  const supabase = await createClient();
  const [firstName, lastName] = splitName(personName);

  const { data: contact, error: contactError } = await supabase
    .from("contacts")
    .insert({
      first_name: firstName,
      last_name: lastName,
      email,
      created_by_workspace_id: input.workspaceId,
    })
    .select("id")
    .single();

  if (contactError || !contact) {
    return reply(`I could not add them: ${contactError?.message ?? "error"}.`);
  }

  const { error: memberError } = await supabase.from("whitbyos_client_members").insert({
    client_id: client!.id,
    contact_id: contact.id,
    role: "contact",
    /* Off, like `create_client` leaves it. Letting somebody into a client's
       portal is a decision with a screen of its own. */
    portal_access: false,
  });

  if (memberError) {
    /* The contact exists but belongs to nobody, which is worse than not
       having made it: it shows up in the directory attached to nothing. */
    await supabase.from("contacts").delete().eq("id", contact.id);
    return reply(`I could not put them on ${client!.name}: ${memberError.message}.`);
  }

  revalidatePath(ROUTE, "page");
  await focusClientWorkspace(client!.id, input.threadId);
  return reply(`Done. ${personName} is on ${client!.name}.`, {
    open: { label: `Open ${client!.name} →`, href: `/whitbyos/clients/${client!.id}/contacts` },
    sections: nextSteps([
      `Invite ${personName} to the portal from the client's Contacts tab — until then they cannot see anything.`,
      `Start a group with them — say "start a group called ${client!.name} with ${personName}".`,
    ]),
  });
}

async function sendMessageFromAsk(input: {
  workspaceId: string;
  userId: string;
  /** Whether this turn actually said yes. See `confirmFirst`. */
  confirmed: boolean;
  slots: AskPendingAction["slots"];
  teammates: Named[];
  pending: AskPendingAction | null | undefined;
}): Promise<Answer> {
  const slots = input.slots;
  const pending: AskPendingAction = {
    intent: "send_message",
    slots,
    awaitingConfirm: true,
  };

  const recipientName = (slots.recipientName ?? "").trim();
  const subject = (slots.name ?? "").trim();
  const body = (slots.messageBody ?? "").trim();

  /* All three at once — see `askAll`. */
  const asks: Ask[] = [];
  if (!recipientName) {
    asks.push({
      q: "who should it go to",
      hint: "A teammate or a client contact, by name.",
      heading: "Your team",
      options: input.teammates.slice(0, 8).map((row) => row.name),
    });
  }
  if (!subject) asks.push({ q: "what is the subject" });
  if (!body) asks.push({ q: "what should it say" });

  if (asks.length > 0) {
    return askAll(
      {
        ...pending,
        awaitingConfirm: false,
        slots: { ...slots, recipientName: recipientName || null, name: subject || null },
      },
      "Sure.",
      asks,
    );
  }

  /*
   * External and client-facing, so it needs a yes — and a real one.
   *
   * This read only the flag on the incoming pending, which is set the moment
   * the preview is shown. Every turn after that therefore arrived already
   * past the gate: "hold on", "make it shorter", "who is that again?" all
   * sent the original message to the original person. It is the one
   * irreversible thing in this file.
   */
  if (!input.pending?.awaitingConfirm || !input.confirmed) {
    return reply(
      `Ready to send “${subject}” to ${recipientName}:\n\n${body}\n\nReply yes to send, or no to cancel.`,
      { pending },
    );
  }

  const supabase = await createClient();
  const teammate = matchNamed(input.teammates, recipientName);

  let participant: { type: "user" | "contact"; id: string } | null = teammate
    ? { type: "user", id: teammate.id }
    : null;

  if (!participant) {
    const { data: contacts } = await supabase
      .from("contacts")
      .select("id, first_name, last_name, preferred_name")
      .eq("created_by_workspace_id", input.workspaceId)
      .limit(80);
    const named = ((contacts ?? []) as {
      id: string;
      first_name?: string | null;
      last_name?: string | null;
      preferred_name?: string | null;
    }[]).map((row) => ({
      id: row.id,
      name:
        row.preferred_name ||
        [row.first_name, row.last_name].filter(Boolean).join(" ") ||
        "Contact",
    }));
    const hit = matchNamed(named, recipientName);
    if (hit) participant = { type: "contact", id: hit.id };
  }

  if (!participant) {
    return reply(
      `I could not find “${recipientName}” among teammates or contacts. Check the name and try again.`,
      { pending: { ...pending, awaitingConfirm: false } },
    );
  }

  const { data: thread, error } = await supabase
    .from("whitbyos_message_threads")
    .insert({
      workspace_id: input.workspaceId,
      subject,
      kind: "direct",
      last_message_at: new Date().toISOString(),
      created_by_user_id: input.userId,
    })
    .select("id")
    .single();

  if (error || !thread) {
    return reply(`I could not start the conversation: ${error?.message ?? "error"}.`);
  }

  const { error: peopleError } = await supabase.from("whitbyos_message_participants").insert([
    {
      thread_id: thread.id,
      participant_type: "user",
      participant_id: input.userId,
      added_by_user_id: input.userId,
      last_read_at: new Date().toISOString(),
    },
    {
      thread_id: thread.id,
      participant_type: participant.type,
      participant_id: participant.id,
      added_by_user_id: input.userId,
    },
  ]);

  if (peopleError) {
    await supabase.from("whitbyos_message_threads").delete().eq("id", thread.id);
    return reply(`I could not add ${recipientName} to the conversation: ${peopleError.message}.`);
  }

  const { error: msgError } = await supabase.from("whitbyos_messages").insert({
    workspace_id: input.workspaceId,
    thread_id: thread.id,
    sender_type: "user",
    sender_id: input.userId,
    body,
    status: "sent",
    source: "whitbyos",
  });

  if (msgError) {
    return reply(`The thread opened but the message failed: ${msgError.message}.`, {
      open: { label: "Open messages →", href: `/whitbyos/messages?thread=${thread.id}` },
    });
  }

  revalidatePath(ROUTE, "page");
  return reply(`Sent. “${subject}” is on its way to ${recipientName}.`, {
    open: { label: "Open conversation →", href: `/whitbyos/messages?thread=${thread.id}` },
  });
}

/**
 * Try to handle a create (or continue a pending one). Returns null when this
 * turn is ordinary Ask Q&A and the caller should fall through.
 */
/**
 * What the screen somebody is standing on is about.
 *
 * The panel opens over any route and passes it as it is. A work plan's page
 * settles both the plan and the request behind it; a request's page settles
 * the request; a client's page settles the client. Anything else settles
 * nothing, which is the ordinary case and perfectly fine — the agent then
 * asks, as it always did.
 *
 * Read here rather than in the panel because the panel is a client
 * component and these are ids it would have to be told; the path it already
 * knows.
 */
async function whereFrom(path: string | null | undefined): Promise<{
  planId: string | null;
  requestId: string | null;
  clientId: string | null;
}> {
  const none = { planId: null, requestId: null, clientId: null };
  const at = (path ?? "").split("?")[0]!.split("/").filter(Boolean);
  if (at[0] !== "whitbyos" || !at[1] || !at[2]) return none;

  const id = at[2];
  // A uuid, or nothing we can look anything up by.
  if (!/^[0-9a-f-]{16,}$/i.test(id)) return none;

  const supabase = await createClient();

  if (at[1] === "work-plans") {
    const { data } = await supabase
      .from("whitbyos_workplans")
      .select("id, request:whitbyos_requests!request_id (id, client_id)")
      .eq("id", id)
      .maybeSingle();

    const request = Array.isArray(data?.request) ? data?.request[0] : data?.request;
    return {
      planId: (data?.id as string | undefined) ?? null,
      requestId: (request?.id as string | undefined) ?? null,
      clientId: (request?.client_id as string | undefined) ?? null,
    };
  }

  if (at[1] === "requests") {
    const { data } = await supabase
      .from("whitbyos_requests")
      .select("id, client_id")
      .eq("id", id)
      .maybeSingle();

    return {
      planId: null,
      requestId: (data?.id as string | undefined) ?? null,
      clientId: (data?.client_id as string | undefined) ?? null,
    };
  }

  if (at[1] === "clients") return { planId: null, requestId: null, clientId: id };

  return none;
}

export async function runAskAgent(
  question: string,
  extra?: {
    prior?: { role: "user" | "whitby"; body: string }[];
    pending?: AskPendingAction | null;
    images?: { mimeType: string; data: string }[];
    threadId?: string | null;
    /**
     * Called when a create is under way and this turn is a question.
     *
     * Returning null hands the turn to the ordinary answer path, which
     * knows nothing about the create and would store a reply with no
     * pending on it — losing the half-filled create for good. This says
     * "keep it", and the caller puts it back on the answer.
     */
    onQuestionDuringCreate?: (pending: AskPendingAction) => void;
    /**
     * The work plan this was asked from, where it was asked from one.
     *
     * The plan's own panel is the second place this agent runs, and there
     * "create a task" means a task on the plan in front of them.
     */
    onPlanId?: string | null;
    /** The request that plan hangs off. Inherited, never asked for again. */
    onRequestId?: string | null;
    /**
     * The route the question came from, for the panel that opens anywhere.
     *
     * The plan panel can say which plan it is on because it is built into
     * one. The bar panel opens over every screen in the product and knows
     * only where it is, so it says that and the ids are read out of it
     * here — `whereFrom`.
     */
    path?: string | null;
  },
): Promise<Answer | null> {
  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) return emptyAnswer("No workspace is open.");

  if (await isWorkspaceReadOnly()) {
    return emptyAnswer(READ_ONLY_MESSAGE);
  }

  // Image-only questions stay on the Q&A path.
  if (!question.trim() && extra?.images?.length) return null;

  const catalog = await loadCatalog(workspaceId);

  /*
   * Where the question was asked from, whichever way it was told.
   *
   * The plan's own panel says so outright; the bar panel passes its route
   * and it is read out of that. Explicit wins, so a surface that knows can
   * always overrule the guess made from a URL.
   */
  const here = await whereFrom(extra?.path);
  const onPlanId = extra?.onPlanId ?? here.planId;
  const onRequestId = extra?.onRequestId ?? here.requestId;

  /*
   * The client whose page this is counts as the open one.
   *
   * Standing on the Khans' client page and saying "add a task" means the
   * Khans, whether or not their workspace is the one selected on the bar.
   * The page is the more specific answer, so it wins for this turn.
   */
  const onClient = here.clientId
    ? catalog.clients.find((row) => row.id === here.clientId) ?? null
    : null;
  if (onClient) catalog.openClient = onClient;
  const {
    data: { user },
  } = await catalog.supabase.auth.getUser();
  if (!user) return emptyAnswer("Your session expired. Sign in and try again.");

  const extracted = await extract(question, workspaceId, {
    clients: catalog.clients,
    requests: catalog.requests.map((r) => ({ id: r.id, name: r.name })),
    teammates: catalog.teammates,
    pending: extra?.pending,
    prior: extra?.prior ?? [],
    openClient: catalog.openClient,
  });

  // No model / parse failure: if we already had a pending create, keep asking;
  // otherwise fall through to Q&A.
  if (!extracted) {
    if (extra?.pending) {
      return reply("I did not catch that. Reply with the missing detail, or say cancel.", {
        pending: extra.pending,
      });
    }
    return null;
  }

  let intent: Intent = extracted.intent;

  /*
   * A question asked in the middle of a create is still a question.
   *
   * Anything the model read as `ask` was cast back to the create in
   * progress, so "which clients do I even have?" never reached the Q&A
   * path: it was taken as an answer and written into the description, which
   * ends up as the request's desired outcome. The only way out was the word
   * cancel. With three or four questions asked at once, wanting to ask one
   * back is the normal thing to do.
   *
   * A question mark, or an opening that can only start a question, leaves
   * the create where it is and gets answered. The pending is untouched, so
   * the next answer carries on from where it was.
   */
  const soundsLikeAQuestion =
    /\?\s*$/.test(question.trim()) ||
    /^\s*(who|what|which|when|where|why|how|whose|is|are|do|does|did|can|could|show|list|tell me)\b/i.test(
      question,
    );

  if (extra?.pending && intent === "ask" && soundsLikeAQuestion) {
    extra.onQuestionDuringCreate?.(extra.pending);
    return null;
  }

  if (extra?.pending && (intent === "ask" || intent === extra.pending.intent)) {
    intent = extra.pending.intent;
  }

  /*
   * "No" only cancels something.
   *
   * The refusal half had no pending check, and it returns an answer, which
   * stops the question ever reaching the Q&A path. So a first message like
   * "No, I don't need a new plan, what is still open for the Khans?" was
   * met with "Okay, I cancelled that" — a reply about nothing, instead of
   * the answer they asked for.
   */
  if (intent === "cancel" || (extracted.confirm === "no" && extra?.pending)) {
    return reply(
      extra?.pending ? "Okay, I have dropped that. What would you like instead?" : "Nothing to cancel.",
    );
  }

  if (intent === "ask" && !extra?.pending) return null;

  const slots = mergeSlots(extra?.pending, extracted);
  // Seed description from the original ask when still empty — not as the title.
  if (!slots.description && question.trim() && intent !== "send_message") {
    slots.description = question.trim();
  }
  /*
   * Taking a date off again.
   *
   * `mergeSlots` only ever writes non-empty values, so a slot once set can
   * be replaced but not emptied — and the summary ends "or tell me what to
   * change", which was only half true: "actually, no target date" left the
   * date exactly where it was and it was written anyway. Said plainly, it
   * is now heard.
   */
  if (
    extra?.pending &&
    /\b(no|without|remove|drop|clear)\s+(a\s+|the\s+)?(target\s+|due\s+)?(date|deadline)\b/i.test(
      question,
    )
  ) {
    slots.dueDate = null;
  }

  /*
   * A starter sentence must not stick as the name — but an answer must.
   *
   * This ran on every turn, so the reply to "what should I call it" was put
   * through the same filter as the opening instruction: "New client
   * onboarding" starts with "new", so it was thrown away and the question
   * asked again, and again, with nothing to say which word was the problem.
   * A client called `New Horizons Ltd` could not be created at all.
   *
   * It only guards the turn the name is lifted out of a free-form
   * instruction. Once a create is under way and Whitby has asked, whatever
   * comes back is the answer.
   */
  if (!extra?.pending && !isUsableTitle(slots.name)) slots.name = null;
  if (isOpenClientPhrase(slots.clientName) && catalog.openClient) {
    slots.clientName = catalog.openClient.name;
  }

  /*
   * The answer to "shall I?", read once and passed down.
   *
   * Every create shows what it understood and waits. What it waits for is a
   * yes — not merely another turn arriving, which is what "the flag is set"
   * amounts to.
   */
  /*
   * Was a summary put to them last turn, and did this turn agree with it?
   *
   * The second is read past the model where the word is unmistakable. A
   * plain "yes" that comes back classified as "unknown" leaves somebody
   * agreeing to the same summary over and over while nothing is created,
   * which is the least forgivable way for this to fail — and only counted
   * while a summary is actually outstanding, so "ok" in ordinary
   * conversation still means nothing in particular.
   */
  const awaiting = extra?.pending?.awaitingConfirm === true && extra.pending.intent === intent;
  const plainYes =
    /^\s*(y|ya|yes+|yep|yup|yeah|ok|okay|sure|fine|great|perfect|go ahead|go on|do it|create it|make it|send it|that is right|thats right|looks good|please do|confirm(ed)?|haan?|ji|bilkul|theek|thik|kar do|kr do)\b/i.test(
      question,
    );
  const confirmed = extracted.confirm === "yes" || (awaiting && plainYes);

  /*
   * There used to be a short cut here that sent the message.
   *
   * It fired on `extra?.pending` being truthy — any pending, of any intent —
   * and then forced `awaitingConfirm: true` onto whatever it found, which is
   * the exact flag the gate inside `sendMessageFromAsk` tests. So a half
   * finished "add a client" sitting in the thread was enough: "actually
   * message Sarah, subject Docs ready, tell her the papers are signed, yes
   * go ahead" walked straight past the preview and sent it. One turn, no
   * confirmation, and the one thing in this file that cannot be taken back.
   *
   * The switch below already routes `send_message` and passes the correctly
   * scoped pending, so the short cut was only ever a way of skipping the
   * check. It is gone.
   */

  switch (intent) {
    case "create_work_plan":
      return createWorkPlanFromAsk({
        workspaceId,
        userId: user.id,
        awaiting,
        confirmed,
        slots,
        clients: catalog.clients,
        requests: catalog.requests,
        openClient: catalog.openClient,
        prompt: question,
        threadId: extra?.threadId,
      });
    case "create_task":
      return createTaskFromAsk({
        workspaceId,
        userId: user.id,
        awaiting,
        confirmed,
        onPlanId,
        onRequestId,
        slots,
        clients: catalog.clients,
        requests: catalog.requests,
        teammates: catalog.teammates,
        openClient: catalog.openClient,
        prompt: question,
        threadId: extra?.threadId,
      });
    case "create_client":
      return createClientFromAsk({
        workspaceId,
        userId: user.id,
        awaiting,
        confirmed,
        slots,
        threadId: extra?.threadId,
      });
    case "create_request":
      return createRequestFromAsk({
        workspaceId,
        userId: user.id,
        awaiting,
        confirmed,
        slots,
        clients: catalog.clients,
        openClient: catalog.openClient,
        prompt: question,
        threadId: extra?.threadId,
      });
    case "create_group":
      return createGroupFromAsk({
        workspaceId,
        userId: user.id,
        awaiting,
        confirmed,
        slots,
        teammates: catalog.teammates,
      });
    case "add_person":
      return addPersonFromAsk({
        workspaceId,
        userId: user.id,
        awaiting,
        confirmed,
        slots,
        clients: catalog.clients,
        openClient: catalog.openClient,
        threadId: extra?.threadId,
      });
    case "send_message":
      return sendMessageFromAsk({
        workspaceId,
        userId: user.id,
        confirmed,
        slots,
        teammates: catalog.teammates,
        pending: extra?.pending?.intent === "send_message" ? extra.pending : null,
      });
    default:
      return null;
  }
}
