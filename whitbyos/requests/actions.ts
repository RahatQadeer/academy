"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { redirect } from "next/navigation";
import { createClient } from "@/base/lib/supabase/server";
import { runWhitbyFirstDrafts } from "@/whitbyos/lib/whitby-drafts";
import { getCurrentWorkspaceId } from "@/whitbyos/lib/workspace";
import { getWorkTypes } from "@/whitbyos/lib/onboarding";
import { recordTimelineEvent, TIMELINE_EVENT } from "@/whitbyos/lib/timeline-events";
import { clientEmailContext } from "@/whitbyos/lib/gmail-context";
import { workspaceKnowledgeContext } from "@/whitbyos/lib/knowledge";
import { draftWorkplan } from "@/whitbyos/lib/ai/draft-workplan";
import { askWhitby, formatAskReply, type AskPendingAction } from "@/whitbyos/lib/ask";
import { listDraftableProviders } from "@/whitbyos/lib/providers";
import {
  currentSteps,
  saveDraftedPlan,
  writeDraftedTasks,
} from "@/whitbyos/lib/workplan";
import { REQUEST_STATUS_VALUES } from "@/whitbyos/lib/request-status";
import type { DialogResult } from "@/whitbyos/components/DialogForm";
import { readOnlyDialogResult, stopIfReadOnly } from "@/whitbyos/lib/read-only";
import { notifyRequestAudience } from "@/whitbyos/lib/notify";
import { resolveClientId } from "@/whitbyos/lib/client-workspace";

const URGENCIES = new Set(["low", "medium", "high", "critical"]);

const LIST = "/whitbyos/requests";

const PRIORITIES = new Set(["low", "standard", "high", "urgent"]);
const URGENCY = new Set(["critical", "high", "medium", "low"]);
const HEALTH = new Set(["on_track", "needs_attention", "at_risk"]);

function backWithError(message: string): never {
  redirect(`${LIST}?new=1&error=${encodeURIComponent(message)}`);
}

/**
 * SRS §6.1 — a Request is one defined outcome the professional is accountable
 * for coordinating.
 *
 * Created open, at Client Account visibility, which is the switcher-level
 * default; §5.6.2's narrower levels (Private to Requestor, Selected People)
 * are changed on the request itself afterwards.
 */
export async function createRequest(
  _previous: DialogResult,
  formData: FormData,
): Promise<DialogResult> {
  const stop = await readOnlyDialogResult();
  if (stop) return stop;

  const submitted = String(formData.get("client_id") ?? "").trim();
  /*
   * "None" is a real answer: a request can sit without a client, and then it
   * shows on every open-client list (and on All requests) rather than only on
   * one relationship.
   */
  const clientId =
    submitted === "none" || submitted === ""
      ? null
      : await resolveClientId(submitted);
  const title = String(formData.get("title") ?? "").trim();
  const priority = String(formData.get("priority") ?? "standard").trim();
  const dueDate = String(formData.get("target_date") ?? "").trim();
  const description = String(formData.get("desired_outcome") ?? "").trim();
  const urgency = String(formData.get("urgency") ?? "medium").trim();
  const health = String(formData.get("health") ?? "on_track").trim();

  if (submitted && submitted !== "none" && !clientId) {
    return { ok: false, error: "Choose a client, or pick None." };
  }
  if (!title) return { ok: false, error: "Title is required." };

  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) return { ok: false, error: "Create your workspace first." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: true, to: `${LIST}?expired=1` };

  const { data: request, error } = await supabase
    .from("whitbyos_requests")
    .insert({
      workspace_id: workspaceId,
      client_id: clientId,
      title,
      desired_outcome: description || null,
      status: "open",
      priority: PRIORITIES.has(priority) ? priority : "standard",
      urgency: URGENCY.has(urgency) ? urgency : "medium",
      health: HEALTH.has(health) ? health : "on_track",
      owner_user_id: user.id,
      target_date: dueDate || null,
      /* No client → not on the portal; see startFromScratch. */
      visibility: clientId ? "client_account" : "private_to_requestor",
    })
    .select("id, title")
    .single();

  if (error) return { ok: false, error: error.message };

  await recordTimelineEvent({
    requestId: request.id as string,
    eventType: TIMELINE_EVENT.requestOpened,
    description: "The Request was opened",
    clientVisible: Boolean(clientId),
  });

  // No revalidatePath here: it remounts the screen the dialog is on, which
  // takes the dialog with it before it can read what came back. The
  // navigation below is a real one, so the destination is fetched fresh.
  //
  // Quick Add opens this over the Dashboard (1.2), so it goes back there with
  // 1.2.1's toast rather than to the Request — the point of Quick Add is not
  // losing the screen you were on.
  if (String(formData.get("from") ?? "") === "home") {
    return {
      ok: true,
      to: `/whitbyos?created=${encodeURIComponent(request.title as string)}`,
    };
  }

  return { ok: true, to: `/whitbyos/requests/${request.id}` };
}

/**
 * SRS §6.5.1 — Build with Whitby.
 *
 * Creates the Request from what was described, asks Whitby for a plan, saves it
 * as a Draft, and opens it for review. Whitby proposes; nothing is active until
 * the professional adopts it (§1.15, §6.4.13).
 *
 * If drafting fails the Request still exists and opens normally — losing the
 * work someone just described because a model was busy would be the worse
 * outcome.
 */
export async function createRequestFromPrompt(formData: FormData) {
  await stopIfReadOnly();

  const clientId = await resolveClientId(String(formData.get("client_id") ?? ""));
  const prompt = String(formData.get("prompt") ?? "").trim();
  // Optional here, and the difference it makes is the whole plan: with a date
  // the scheduler works backwards from it, without one the drafter's own
  // offsets stand.
  const dueDate = String(formData.get("target_date") ?? "").trim();

  if (!prompt) redirect(LIST);
  if (!clientId) backWithError("Choose the client this request is for.");

  // First sentence becomes the title; the whole prompt stays as the outcome.
  const firstSentence = prompt.split(/(?<=[.!?])\s/)[0] ?? prompt;
  const title =
    firstSentence.length > 80 ? `${firstSentence.slice(0, 77)}…` : firstSentence;

  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) return { ok: false, error: "Create your workspace first." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: true, to: `${LIST}?expired=1` };

  const { data: request, error } = await supabase
    .from("whitbyos_requests")
    .insert({
      workspace_id: workspaceId,
      client_id: clientId,
      title,
      desired_outcome: prompt,
      status: "open",
      priority: "standard",
      owner_user_id: user.id,
      visibility: "client_account",
    })
    .select("id")
    .single();

  if (error) backWithError(error.message);

  await recordTimelineEvent({
    requestId: request.id as string,
    eventType: TIMELINE_EVENT.requestOpened,
    description: "The Request was opened and Whitby was asked to draft a plan",
    clientVisible: true,
  });

  const { data: client } = await supabase
    .from("whitbyos_clients")
    .select("name")
    .eq("id", clientId)
    .maybeSingle();

  const drafted = await draftWorkplan({
    /* No Configure step on this path, so no dials and, until now, no limit
       at all: this drafted with nothing in the prompt about length and
       nothing cut afterwards. "standard" is what that screen starts on. */
    size: "standard",
    workspaceId,
    providers: await listDraftableProviders(),
    requestTitle: title,
    description: prompt,
    clientName: (client?.name as string) ?? "the client",
    workTypes: await getWorkTypes(),
    emailContext: await clientEmailContext(clientId),
    knowledgeContext: await workspaceKnowledgeContext(`${title}\n${prompt}`, clientId),
  });

  if (drafted.ok) {
    await saveDraftedPlan({
      requestId: request.id,
      ownerUserId: user.id,
      plan: drafted.data,
      replaceDraft: true,
      // The Request's own due date is the plan's deadline — it is the date
      // somebody typed when they said what they needed.
      targetDate: dueDate || null,
    });
    revalidatePath(LIST);
    redirect(`/whitbyos/requests/${request.id}/plan`);
  }

  revalidatePath(LIST);
  redirect(
    `/whitbyos/requests/${request.id}?draft_error=${encodeURIComponent(drafted.error)}`,
  );
}

/**
 * Build a plan for a Request that has none.
 *
 * The Request detail used to say "describe what this request needs on the
 * Requests screen" — which is where a *new* Request is described, so following
 * it produced a second Request rather than a plan for this one. There was no
 * route from a Request to its own plan at all.
 *
 * Whitby drafts it from what the Request already says, since that is exactly
 * what §6.5.1 asks: the professional described the work once, and should not
 * have to describe it again to get a plan out of it.
 */
export async function draftPlanForRequest(formData: FormData) {
  await stopIfReadOnly();

  const requestId = String(formData.get("request_id") ?? "").trim();
  if (!requestId) redirect(LIST);

  const detail = `/whitbyos/requests/${requestId}`;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: request } = await supabase
    .from("whitbyos_requests")
    .select("id, title, desired_outcome, target_date, client:whitbyos_clients!client_id (id, name)")
    .eq("id", requestId)
    .maybeSingle();

  if (!request) redirect(LIST);
  if (!user) redirect(`${detail}?draft_error=${encodeURIComponent("Your session expired. Sign in and try again.")}`);

  const client = Array.isArray(request.client) ? request.client[0] : request.client;

  /* So the drafting is billed to somebody. It is the most expensive call in
     the product and it was metered to nobody at all. */
  const workspaceId = await getCurrentWorkspaceId();

  const drafted = await draftWorkplan({
    /* No Configure step on this path, so no dials and, until now, no limit
       at all: this drafted with nothing in the prompt about length and
       nothing cut afterwards. "standard" is what that screen starts on. */
    size: "standard",
    workspaceId: workspaceId ?? undefined,
    providers: await listDraftableProviders(),
    requestTitle: request.title as string,
    description: (request.desired_outcome as string) || (request.title as string),
    clientName: (client?.name as string) ?? "the client",
    workTypes: await getWorkTypes(),
    emailContext: await clientEmailContext((client?.id as string) ?? null),
    knowledgeContext: await workspaceKnowledgeContext(
      [(request.title as string), (request.desired_outcome as string) || ""].join("\n"),
      (client?.id as string) ?? null,
    ),
  });

  if (!drafted.ok) {
    redirect(`${detail}?draft_error=${encodeURIComponent(drafted.error)}`);
  }

  await saveDraftedPlan({
    requestId,
    ownerUserId: user.id,
    plan: drafted.data,
    replaceDraft: true,
    targetDate: (request.target_date as string | null)?.slice(0, 10) ?? null,
  });

  revalidatePath("/[product]/[[...slug]]", "page");
  redirect(`${detail}/plan`);
}

/**
 * The same thing by hand — an empty plan on this Request, opened in WP.15's
 * build step. For work the professional would rather structure themselves.
 */
export async function startEmptyPlanForRequest(formData: FormData) {
  await stopIfReadOnly();

  const requestId = String(formData.get("request_id") ?? "").trim();
  if (!requestId) redirect(LIST);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: request } = await supabase
    .from("whitbyos_requests")
    .select("id, title, urgency, health")
    .eq("id", requestId)
    .maybeSingle();

  if (!request) redirect(LIST);

  const { data: plan, error } = await supabase
    .from("whitbyos_workplans")
    .insert({
      request_id: requestId,
      name: request.title as string,
      status: "draft",
      urgency: (request.urgency as string) ?? "medium",
      health: (request.health as string) ?? "on_track",
      owner_user_id: user?.id ?? null,
    })
    .select("id")
    .single();

  if (error || !plan) {
    redirect(
      `/whitbyos/requests/${requestId}?draft_error=${encodeURIComponent(
        error?.message ?? "Could not start the plan.",
      )}`,
    );
  }

  revalidatePath("/[product]/[[...slug]]", "page");
  redirect(`/whitbyos/work-plans/${plan.id}?wizard=scratch`);
}

/**
 * Screen 3.2.1 — refine the drafted plan by telling Whitby what to change.
 *
 * Whitby is given the plan it already wrote and asked to apply exactly the one
 * change, keeping everything else word for word. §12.1.2 has it proposing
 * rather than deciding, and a model that quietly rewrites four other steps
 * while fixing one is deciding.
 *
 * Each exchange writes a version — the instruction as its change reason, the
 * plan as its snapshot — so the conversation and the plan's history are the
 * same record and cannot disagree.
 */
/** What an inline caller gets back instead of a new page. */
export type RefineResult = {
  ok: boolean;
  error?: string;
  summary?: string;
  /** Whether the reply is an answer to a question rather than a change. */
  answered?: boolean;
  /**
   * Whether the refusal is advice rather than a fault.
   *
   * A half-finished sentence is not an outage, and answering it in the red
   * an outage uses makes a mistake out of a half-thought. The panel draws a
   * hint the way it draws any other reply.
   */
  hint?: boolean;
  /**
   * A create still being filled in, handed back for the next turn.
   *
   * This panel has no thread of its own to keep one on, the way the Ask page
   * does, so it travels through the form: the panel holds it and posts it
   * back. Lost on a reload, which is the honest limit of a side panel — and
   * far better than what it did before, which was to drop the create
   * silently and answer "Noted." to the yes.
   */
  pending?: AskPendingAction | null;
};

/**
 * Words that are somebody talking, not somebody asking for a change.
 *
 * "okay done" is nine characters and two words, which cleared every bar this
 * had, and a plan of twelve tasks was redrafted from it: half a minute of
 * model call, a new version in the history, and every date moved, because
 * somebody said thank you. Anything made only of these is answered and
 * nothing is touched.
 *
 * Deliberately short. A word that could begin an instruction is not on it —
 * "no" and "yes" are here because alone they change nothing, but "not" and
 * "remove" are the start of a sentence that does.
 */
const SMALL_TALK = new Set([
  "ok",
  "okay",
  "k",
  "kk",
  "done",
  "finished",
  "thanks",
  "thank",
  "you",
  "thankyou",
  "ty",
  "great",
  "good",
  "nice",
  "cool",
  "perfect",
  "lovely",
  "fine",
  "yes",
  "yep",
  "yeah",
  "yup",
  "no",
  "nope",
  "got",
  "it",
  "hi",
  "hello",
  "hey",
  "sure",
  "cheers",
  "👍",
  "👌",
  "🙏",
  "😊",
]);

/**
 * Somebody asking, rather than somebody telling.
 *
 * "From where is that? How do I check?" is a question about the plan, and it
 * was read as an instruction: the plan was redrafted and seven tasks were
 * redated because somebody wanted to know something. A question mark, or an
 * opening word that can only begin a question, is enough to tell them apart
 * without asking a model which it is.
 */
const ASKING = /^(what|where|when|why|who|whose|which|how|is|are|was|were|do|does|did|can|could|should|would|will|shall|has|have|any)\b/i;

function aQuestion(text: string) {
  const said = text.trim();
  if (!said) return false;

  /* A question mark settles it. Otherwise the opening word has to be one that
     cannot begin an instruction: "move the housing" is a change, "how does
     housing work" is not. */
  return said.endsWith("?") || ASKING.test(said);
}

/** Whether a whole message is made of nothing but those. */
function smallTalk(text: string) {
  const words = text
    .toLowerCase()
    .replace(/[.!?,…]+/g, " ")
    .split(/\s+/)
    .filter(Boolean);

  /* Four words is the ceiling: "ok thanks that is great" is still nobody
     asking for anything, and anything longer is worth reading properly. */
  return words.length > 0 && words.length <= 4 && words.every((word) => SMALL_TALK.has(word));
}

/** Said when the plan came back identical, which is a real answer. */
const NOTHING =
  "That came back with the plan unchanged. Try naming the Work Stream or the task and what it should say instead.";

type PlanShape = {
  /** Task title to the day it is due, for the whole plan. */
  due: Map<string, string | null>;
  /** Which Work Stream each task sits in, by name. */
  stream: Map<string, string>;
};

/**
 * The plan as it stands: every task, its date, and the stream it is in.
 *
 * Compared either side of a refinement so the answer can say what actually
 * moved rather than how big the plan is — which is true after every
 * instruction and therefore says nothing about the one just given.
 */
async function planShape(
  supabase: Awaited<ReturnType<typeof createClient>>,
  planId: string,
): Promise<PlanShape> {
  const due = new Map<string, string | null>();
  const stream = new Map<string, string>();

  const { data: streams } = await supabase
    .from("whitbyos_workstreams")
    .select("id, name")
    .eq("workplan_id", planId);

  const names = new Map((streams ?? []).map((row) => [row.id as string, row.name as string]));
  if (names.size === 0) return { due, stream };

  const { data: tasks } = await supabase
    .from("whitbyos_tasks")
    .select("title, due_date, workstream_id")
    .in("workstream_id", [...names.keys()]);

  for (const task of tasks ?? []) {
    const title = (task.title as string) ?? "";
    if (!title) continue;
    due.set(title, ((task.due_date as string | null) ?? null)?.slice(0, 10) ?? null);
    stream.set(title, names.get(task.workstream_id as string) ?? "");
  }

  return { due, stream };
}

/**
 * One sentence about the difference between two versions of a plan.
 *
 * Added, dropped and moved, in that order, with the Work Streams named where
 * naming them helps. Empty when the two are the same, which is what tells the
 * panel to say so plainly.
 */
function whatChanged(before: PlanShape, after: PlanShape): string {
  const added = [...after.due.keys()].filter((title) => !before.due.has(title));
  const dropped = [...before.due.keys()].filter((title) => !after.due.has(title));
  const moved = [...after.due.keys()].filter(
    (title) => before.due.has(title) && before.due.get(title) !== after.due.get(title),
  );

  const touched = [
    ...new Set(
      [...added, ...moved]
        .map((title) => after.stream.get(title) ?? "")
        .filter(Boolean),
    ),
  ];

  const parts: string[] = [];
  if (added.length > 0) parts.push(`${added.length} task${added.length === 1 ? "" : "s"} added`);
  if (dropped.length > 0) {
    parts.push(`${dropped.length} task${dropped.length === 1 ? "" : "s"} removed`);
  }
  if (moved.length > 0) parts.push(`${moved.length} redated`);

  if (parts.length === 0) return "";

  const named =
    touched.length > 0
      ? ` in ${touched.slice(0, 3).join(", ")}${touched.length > 3 ? ` and ${touched.length - 3} more` : ""}`
      : "";

  const sentence = parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;

  return `${sentence[0].toUpperCase()}${sentence.slice(1)}${named}.`;
}

/**
 * WP.11 and WP.14 — change the plan by describing the change.
 *
 * Two callers with two different needs. The Request's refine screen is a page
 * and wants to land on the plan afterwards. The Ask Whitby panel is a
 * conversation sitting beside the plan, and a redirect there reloads the page
 * out from under it — the question and the working dots are thrown away, and
 * the answer arrives only after a full page load, which is exactly what a
 * conversation should not feel like.
 *
 * So `inline=1` makes it answer rather than navigate. The panel refreshes the
 * plan behind itself, which updates the Work Streams in place without the
 * page going anywhere.
 */
/**
 * The half-finished create the panel is holding, if any.
 *
 * Posted as JSON because a `FormData` carries strings. Anything unreadable
 * is treated as nothing at all — a malformed pending is a create nobody can
 * finish, and starting again is better than acting on half of one.
 */
function readPendingFrom(formData: FormData): AskPendingAction | null {
  const raw = String(formData.get("pending") ?? "").trim();
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as AskPendingAction;
    return parsed && typeof parsed === "object" && parsed.intent ? parsed : null;
  } catch {
    return null;
  }
}

export async function refineWorkplan(formData: FormData): Promise<RefineResult | void> {
  await stopIfReadOnly();

  const inline = String(formData.get("inline") ?? "") === "1";

  const requestId = String(formData.get("request_id") ?? "").trim();
  const instruction = String(formData.get("instruction") ?? "").trim();
  if (!requestId) {
    if (inline) return { ok: false, error: "That plan could not be found." };
    redirect(LIST);
  }

  // WP.11 and WP.14 ask from the plan's own rail, and should come back to it
  // rather than being moved to the Request's refine screen mid-thought.
  const returnTo = String(formData.get("return_to") ?? "").trim();
  const refine = returnTo.startsWith("/whitbyos/")
    ? returnTo
    : `/whitbyos/requests/${requestId}/plan/refine`;
  /**
   * A refinement replaces the whole plan, so it has to be asked for.
   *
   * Somebody typed a full stop into the box and the plan was rewritten from
   * it: fifteen tasks redrafted out of a single character that asked for
   * nothing. The model will always answer something, and what it answers to
   * "." is a plan it invented reasons for.
   *
   * Two words and a few characters is the bar. It is low on purpose — "move
   * housing later" should go through — and it is enough to stop a stray
   * keystroke rewriting somebody's work.
   */
  /*
   * Whitby's own create agent gets the turn first.
   *
   * This box rewrites plans, and that is all it could do: "create a task for
   * the attestation" went straight to the drafter and *redrafted the whole
   * plan* from it. Fifteen tasks rewritten because somebody asked for one.
   * The agent, meanwhile, was reachable only by accident — through the
   * question gate, and only if the sentence happened to start with a
   * question word — and whatever it asked for next was thrown away.
   *
   * `runAskAgent` returns null unless it is actually taking the turn, so
   * refinement is untouched: "move the housing work a week later" is not a
   * create, the agent declines, and the drafter has it as before.
   */
  const carried = readPendingFrom(formData);

  if (instruction) {
    const { runAskAgent } = await import("@/whitbyos/lib/ask-agent");
    const acted = await runAskAgent(instruction, {
      pending: carried,
      onPlanId: String(formData.get("on_plan_id") ?? "").trim() || null,
      /* The panel is on a plan, which hangs off this request. Whatever it
         makes belongs here unless somebody says otherwise. */
      onRequestId: requestId,
    });

    if (acted) {
      const said =
        formatAskReply(acted) || "I could not work out what to make from that.";
      const next = acted.pending ?? null;

      if (inline) return { ok: true, summary: said, answered: true, pending: next };
      redirect(`${refine}${refine.includes("?") ? "&" : "?"}error=${encodeURIComponent(said)}`);
    }
  }

  /*
   * Somebody saying thank you is not an instruction.
   *
   * Answered here, before anything is read or written: the plan is not
   * touched, no version is written, and the reply is the one a person would
   * give.
   */
  if (instruction && !carried && smallTalk(instruction)) {
    const said = instruction.trim().toLowerCase();
    const closing = /^(thanks|thank you|thankyou|ty|cheers)\b/.test(said)
      ? "Any time. Tell me what to change whenever you want."
      : /^(hi|hello|hey)\b/.test(said)
        ? "Hello. Tell me what to change, or ask about this plan."
        : "Noted.";

    /* A turn, not a refusal. "ok" used to come back as a hint with no user
       bubble, so the acknowledgement vanished and only "nothing changed"
       remained — which is the wrong thing to say to somebody who just
       accepted an answer. */
    if (inline) return { ok: true, summary: closing, answered: true };
    redirect(`${refine}${refine.includes("?") ? "&" : "?"}error=${encodeURIComponent(closing)}`);
  }

  /*
   * A question is answered, not acted on.
   *
   * The panel rewrites plans; it is also the only box on the screen, so it is
   * where people ask about one. Sending the question to the same drafter
   * rewrote the plan from it — an answer nobody asked for, in place of the
   * one they did. `askWhitby` reads and never writes.
   */
  if (instruction && aQuestion(instruction)) {
    const onPlan = String(formData.get("on_plan_id") ?? "").trim();
    /* Where it was asked from, so the answer leads with the plan somebody
       is standing on rather than with the whole firm. The panel already
       sends the plan id; it was never passed on. */
    const answer = await askWhitby(instruction, {
      path: onPlan ? `/whitbyos/work-plans/${onPlan}` : undefined,
    });

    const reply =
      formatAskReply(answer) ||
      "I could not find an answer to that in this workspace. Ask me to change something instead, and I will redraw the plan.";

    if (inline) return { ok: true, summary: reply, answered: true };
    redirect(`${refine}${refine.includes("?") ? "&" : "?"}error=${encodeURIComponent(reply)}`);
  }

  const meaningful =
    instruction.length >= 8 && instruction.split(/\s+/).filter(Boolean).length >= 2;

  if (!instruction || !meaningful) {
    const why = instruction
      ? "Tell me what to change, in a few words. For example: \u201cmove the housing work a week later\u201d."
      : "Tell me what you would like changed.";

    if (inline) return { ok: false, error: why, hint: true };
    redirect(`${refine}${refine.includes("?") ? "&" : "?"}error=${encodeURIComponent(why)}`);
  }

  /**
   * Add the error to wherever we are going back to, whether or not it already
   * carries a query.
   *
   * The plan's rail sends us back to `…?whitby=1`, and appending "?error=…" to
   * that produced a second question mark. The browser reads everything after
   * the first one as the query, so `whitby` came back as
   * "1?error=Could not reach the model", which is not "1" — the Ask Whitby
   * panel decided it was not open and vanished, taking the message with it.
   */
  const backWith = (message: string) =>
    `${refine}${refine.includes("?") ? "&" : "?"}error=${encodeURIComponent(message)}`;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: request } = await supabase
    .from("whitbyos_requests")
    .select("id, title, desired_outcome, target_date, client:whitbyos_clients!client_id (id, name)")
    .eq("id", requestId)
    .maybeSingle();

  // The newest plan still standing. maybeSingle() alone would throw on a
  // Request carrying more than one, which migration 038 allows.
  const { data: plan } = await supabase
    .from("whitbyos_workplans")
    .select("id, version, target_date")
    .eq("request_id", requestId)
    .is("archived_at", null)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!request || !plan || !user) {
    if (inline) return { ok: false, error: "That plan could not be found." };
    redirect(`/whitbyos/requests/${requestId}`);
  }

  const client = Array.isArray(request.client) ? request.client[0] : request.client;

  /* So the drafting is billed to somebody. It is the most expensive call in
     the product and it was metered to nobody at all. */
  const workspaceId = await getCurrentWorkspaceId();

  const drafted = await draftWorkplan({
    workspaceId: workspaceId ?? undefined,
    providers: await listDraftableProviders(),
    requestTitle: request.title as string,
    description: (request.desired_outcome as string) || (request.title as string),
    clientName: (client?.name as string) ?? "the client",
    workTypes: await getWorkTypes(),
    emailContext: await clientEmailContext((client?.id as string) ?? null),
    knowledgeContext: await workspaceKnowledgeContext(
      [(request.title as string), (request.desired_outcome as string) || "", instruction].join(
        "\n",
      ),
      (client?.id as string) ?? null,
    ),
    currentSteps: await currentSteps(plan.id as string),
    instruction,
    // Without this a refinement had no calendar to spread across, so every
    // step it rewrote came back undated — and since a refinement rewrites the
    // whole plan, one question stripped the dates off all of it.
    targetDate: (plan.target_date as string | null)?.slice(0, 10),
  });

  if (!drafted.ok) {
    if (inline) return { ok: false, error: drafted.error };
    redirect(backWith(drafted.error));
  }

  const version = ((plan.version as number) ?? 1) + 1;

  await supabase.from("whitbyos_workplan_versions").insert({
    workplan_id: plan.id,
    version_number: version,
    snapshot: drafted.data,
    change_reason: instruction,
    created_by_user_id: user.id,
  });

  /*
   * What the plan says now, so the answer can say what changed.
   *
   * Read before the replacement, compared with what lands after it. The
   * drafter's own `change` markers cannot carry this: it marks a step it
   * reworded, and says nothing about a step it merely moved — so "move the
   * housing work a week later", which is exactly a date change and nothing
   * else, came back as "nothing needed changing".
   */
  const before = await planShape(supabase, plan.id as string);

  // The plan is replaced rather than appended to: the professional asked for a
  // different plan, not a longer one. Tasks go with their streams through the
  // cascade, so only the streams are deleted.
  //
  // The error is read, and refusal stops here. Unread, this delete failed on a
  // foreign key and the insert below went ahead anyway, so every refinement
  // left a second whole copy of the plan behind — four Work Streams became
  // nine, then fourteen. Migration 040 fixed the keys; this makes sure a
  // failure can never again look like success.
  const { error: cleared } = await supabase
    .from("whitbyos_workstreams")
    .delete()
    .eq("workplan_id", plan.id);

  if (cleared) {
    const failure = `The plan could not be replaced, so nothing was changed. ${cleared.message}`;
    if (inline) return { ok: false, error: failure };
    redirect(backWith(failure));
  }

  const { data: streams } = await supabase
    .from("whitbyos_workstreams")
    .insert(
      drafted.data.workStreams.map((stream, index) => ({
        workplan_id: plan.id,
        name: stream.name,
        purpose: stream.purpose,
        status: "not_started",
        sort_order: index,
      })),
    )
    .select("id");

  const { data: parent } = await supabase
    .from("whitbyos_requests")
    .select("workspace_id")
    .eq("id", requestId)
    .maybeSingle();

  /**
   * The same writer the first draft uses.
   *
   * This used to insert a title, a kind and a date, and put every task on
   * whoever pressed the button. So asking Whitby to move one Work Stream a
   * week later quietly stripped the plan of its steps, its durations, its
   * dependencies, its providers and its assignment, and handed all fifteen
   * tasks to one person — a refinement that hollowed out everything it did not
   * mention, which is the opposite of what it promises.
   */
  await writeDraftedTasks({
    supabase,
    workspaceId: parent?.workspace_id as string,
    requestId,
    workplanId: plan.id as string,
    plan: drafted.data,
    streams: (streams ?? []) as { id: string }[],
    targetDate: (plan.target_date as string | null) ?? null,
  });

  // The plan was replaced, so the notes about the old one are about a plan that
  // no longer exists. Open ones go; anything already dismissed or resolved is a
  // decision the professional made and stays on the record.
  await supabase
    .from("whitbyos_considerations")
    .delete()
    .eq("workplan_id", plan.id)
    .eq("status", "open");

  const byName = new Map(
    drafted.data.workStreams.map((stream, index) => [
      stream.name,
      (streams ?? [])[index]?.id ?? null,
    ]),
  );

  if ((drafted.data.considerations ?? []).length > 0) {
    await supabase.from("whitbyos_considerations").insert(
      drafted.data.considerations.map((consideration) => ({
        workplan_id: plan.id,
        workstream_id: consideration.workStream
          ? (byName.get(consideration.workStream) ?? null)
          : null,
        type: consideration.type,
        body: consideration.body,
        source_reference: "Whitby, when this plan was refined",
        status: "open",
      })),
    );
  }

  /**
   * The name stays. It is not Whitby's to change.
   *
   * A refinement rewrites the work, and this rewrote the plan's name with it —
   * so somebody who had named their plan, asked for one change, and came back
   * to find it called something else. The name is how a person finds their
   * plan in a list of twelve; a model renaming it is a plan going missing.
   *
   * The outcome and the definition of done do follow the work, because they
   * describe it and the work has just changed. Renaming stays where it
   * belongs, on Edit.
   */
  await supabase
    .from("whitbyos_workplans")
    .update({
      desired_outcome: drafted.data.desiredOutcome,
      definition_of_done: drafted.data.definitionOfDone,
      version,
      updated_at: new Date().toISOString(),
    })
    .eq("id", plan.id);

  revalidatePath("/[product]/[[...slug]]", "page");

  if (inline) {
    const streams = drafted.data.workStreams;
    const steps = streams.reduce((count, stream) => count + (stream.steps?.length ?? 0), 0);
    const after = await planShape(supabase, plan.id as string);

    /*
     * What actually changed, in the plan's own words.
     *
     * The reply used to be the size of the plan — "4 Work Streams and 22
     * tasks" — which is true after every instruction and therefore says
     * nothing about the one that was just given. The drafter marks each step
     * it touched (`change`), so the answer can name the Work Streams it went
     * into, and can say plainly when it went into none: an instruction that
     * changed nothing is the one thing somebody most needs to be told, and it
     * was the one thing that read exactly like success.
     */
    const size = `The plan now has ${steps} task${steps === 1 ? "" : "s"} across ${streams.length} Work Stream${streams.length === 1 ? "" : "s"}.`;
    const said = whatChanged(before, after);

    return {
      ok: true,
      summary: said ? `Done. ${said} ${size}` : `${NOTHING} ${size}`,
    };
  }

  redirect(refine);
}

/**
 * SRS §6.16 — closing out.
 *
 * A Request is closed, never deleted (§1.16, §6.16.3): its timeline, decisions,
 * documents and evidence are the record of what was promised and done, and in
 * this line of work that record is the point. Closing preserves all of it, and
 * §1.16 allows an authorised user to reopen.
 *
 * The Work Summary is required because §6.16.1 makes it part of closeout — a
 * Request closed with no account of what happened defeats the reason for
 * keeping it.
 */
/**
 * Screen 3.3x — Edit Request.
 *
 * The five fields the reference draws, and nothing else. Closing is still its
 * own thing with its own dialog, because closing asks for a Work Summary and
 * this does not — a status set to Completed here is a correction, not a
 * closeout.
 */
export async function updateRequest(formData: FormData) {
  await stopIfReadOnly();

  const requestId = String(formData.get("request_id") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const outcome = String(formData.get("desired_outcome") ?? "").trim();
  const status = String(formData.get("status") ?? "").trim();
  const urgency = String(formData.get("urgency") ?? "").trim();
  const targetDate = String(formData.get("target_date") ?? "").trim();

  if (!requestId) redirect(LIST);

  const detail = `/whitbyos/requests/${requestId}`;
  const failed = (message: string) =>
    redirect(`${detail}?edit=1&error=${encodeURIComponent(message)}`);

  if (!title) failed("A request needs a title.");

  const supabase = await createClient();

  const { error } = await supabase
    .from("whitbyos_requests")
    .update({
      title,
      desired_outcome: outcome || null,
      status: REQUEST_STATUS_VALUES.has(status as never) ? status : "not_started",
      urgency: URGENCIES.has(urgency) ? urgency : null,
      target_date: targetDate || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", requestId);

  if (error) failed(error.message);

  await recordTimelineEvent({
    requestId,
    eventType: TIMELINE_EVENT.requestUpdated,
    description: "The Request's details were updated",
    clientVisible: true,
  });
  revalidatePath(LIST);
  redirect(detail);
}

export async function closeRequest(formData: FormData) {
  await stopIfReadOnly();

  const requestId = String(formData.get("request_id") ?? "").trim();
  const workSummary = String(formData.get("work_summary") ?? "").trim();
  if (!requestId) redirect(LIST);

  const detail = `/whitbyos/requests/${requestId}`;

  if (!workSummary) {
    redirect(
      `${detail}?close=1&error=${encodeURIComponent("A Work Summary is required to close a request.")}`,
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase
    .from("whitbyos_requests")
    .update({
      status: "complete",
      work_summary: workSummary,
      closed_at: new Date().toISOString(),
      closed_by_user_id: user?.id ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", requestId);

  if (error) {
    redirect(`${detail}?close=1&error=${encodeURIComponent(error.message)}`);
  }

  // A completed Request's plans are complete too — all of them, since a
  // Request may carry several, but not the ones already filed away.
  await supabase
    .from("whitbyos_workplans")
    .update({ status: "complete", updated_at: new Date().toISOString() })
    .eq("request_id", requestId)
    .is("archived_at", null)
    .is("deleted_at", null);

  await tellClientOfStatus(requestId, "request_completed", "Request completed");

  await recordTimelineEvent({
    requestId,
    eventType: TIMELINE_EVENT.requestClosed,
    description: "The Request was closed",
    clientVisible: true,
  });
  revalidatePath(LIST);
  redirect(detail);
}

/**
 * The portal's "Request status change", told to the people the portal shows
 * this Request to. Closing and reopening are kept as two kinds so that one
 * unread notice cannot stand in for the other: a client who missed "completed"
 * and then sees nothing about "reopened" would believe the first.
 */
async function tellClientOfStatus(requestId: string, kind: string, title: string) {
  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) return;

  await notifyRequestAudience({
    workspaceId,
    requestId,
    event: "request_status_change",
    area: "requests",
    kind,
    title,
    href: `/client-portal/requests/${requestId}`,
    entityType: "request",
    entityId: requestId,
  });
}

/** SRS §1.16 — an authorised user may reopen a closed Request. */
export async function reopenRequest(formData: FormData) {
  await stopIfReadOnly();

  const requestId = String(formData.get("request_id") ?? "").trim();
  if (!requestId) redirect(LIST);

  const supabase = await createClient();

  await supabase
    .from("whitbyos_requests")
    .update({
      status: "running",
      closed_at: null,
      closed_by_user_id: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", requestId);

  // The Work Summary is deliberately kept — it is the record of the previous
  // closeout, and losing it on reopen would defeat the point of closing.
  await supabase
    .from("whitbyos_workplans")
    .update({ status: "active", updated_at: new Date().toISOString() })
    .eq("request_id", requestId)
    .is("archived_at", null)
    .is("deleted_at", null);

  await tellClientOfStatus(requestId, "request_reopened", "Request reopened");

  await recordTimelineEvent({
    requestId,
    eventType: TIMELINE_EVENT.requestReopened,
    description: "The Request was reopened",
    clientVisible: true,
  });
  revalidatePath(LIST);
  redirect(`/whitbyos/requests/${requestId}`);
}

/**
 * SRS §6.4.13 — the professional adopts the drafted plan, and only then does it
 * become live work. Whitby never activates its own plan.
 */
export async function activateWorkplan(formData: FormData) {
  await stopIfReadOnly();

  const requestId = String(formData.get("request_id") ?? "").trim();
  const workplanId = String(formData.get("workplan_id") ?? "").trim();
  if (!requestId || !workplanId) redirect(LIST);

  const supabase = await createClient();
  await supabase
    .from("whitbyos_workplans")
    .update({ status: "active", updated_at: new Date().toISOString() })
    .eq("id", workplanId);

  await supabase
    .from("whitbyos_requests")
    .update({ status: "running", updated_at: new Date().toISOString() })
    .eq("id", requestId);

  await recordTimelineEvent({
    requestId,
    eventType: TIMELINE_EVENT.planActivated,
    description: "The Work Plan was adopted and this Request is now running",
    sourceReference: workplanId,
    clientVisible: true,
  });

  /*
   * Whitby gets on with its own share.
   *
   * Adoption is the moment the plan becomes real work, and it is also the
   * moment the professional stops looking at it. Every task Whitby itself
   * classified `auto` gets a first pass written onto it, after the redirect
   * has gone out, so nothing here is on the path of the button.
   *
   * Read before the redirect, because `redirect` throws and nothing after it
   * runs. The workspace is read here for the same reason: `after` runs
   * outside the request, where the session it would need is gone.
   */
  const workspaceId = await getCurrentWorkspaceId();
  after(() => runWhitbyFirstDrafts(workplanId, workspaceId));

  revalidatePath("/[product]/[[...slug]]", "page");
  // The plan is the thing that is now live, so that is where adopting it
  // lands — the Request detail only summarises it.
  redirect(`/whitbyos/work-plans/${workplanId}`);
}


/**
 * 3.3n — a note on a Request.
 *
 * Internal unless someone says otherwise. §6.11 keeps the team's own notes
 * apart from what a client sees, and that is the safe default: a note meant for
 * them can be shown later, one shown by accident cannot be unseen.
 */
export async function addRequestNote(formData: FormData) {
  await stopIfReadOnly();

  const requestId = String(formData.get("request_id") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const clientVisible = formData.get("client_visible") === "on";

  const back = `/whitbyos/requests/${requestId}/notes`;
  if (!requestId || !body) redirect(back);

  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) redirect(back);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: request } = await supabase
    .from("whitbyos_requests")
    .select("id")
    .eq("id", requestId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (!request) redirect(back);

  const { error } = await supabase.from("whitbyos_notes").insert({
    request_id: requestId,
    type: "note",
    body,
    visibility: clientVisible ? "client_visible" : "internal",
    created_by_user_id: user.id,
  });

  if (error) redirect(`${back}?error=${encodeURIComponent(error.message)}`);

  await recordTimelineEvent({
    requestId,
    eventType: TIMELINE_EVENT.noteAdded,
    description: "A note was added",
    // Follows the note's own visibility rather than inventing a second answer
    // to the same question.
    clientVisible,
  });
  revalidatePath("/[product]/[[...slug]]", "page");
  redirect(back);
}

/**
 * Screen 3.3p — put a directory provider on this Request.
 *
 * Writes `whitbyos_provider_options`, the same link Work Streams use, so the
 * request tab and a plan cannot name different firms for the same pairing.
 */
export async function attachRequestProvider(formData: FormData) {
  await stopIfReadOnly();

  const requestId = String(formData.get("request_id") ?? "").trim();
  const providerId = String(formData.get("provider_id") ?? "").trim();
  const back = `/whitbyos/requests/${requestId}/providers`;

  if (!requestId) redirect(LIST);
  if (!providerId) redirect(`${back}?add=1&error=${encodeURIComponent("Choose a provider.")}`);

  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) redirect(LIST);

  const supabase = await createClient();
  const { data: request } = await supabase
    .from("whitbyos_requests")
    .select("id")
    .eq("id", requestId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (!request) redirect(LIST);

  const { error } = await supabase.from("whitbyos_provider_options").insert({
    request_id: requestId,
    provider_id: providerId,
    status: "option_for_review",
  });

  if (error) redirect(`${back}?add=1&error=${encodeURIComponent(error.message)}`);

  await recordTimelineEvent({
    requestId,
    eventType: TIMELINE_EVENT.providerAdded,
    description: "A provider was put forward for review",
    sourceReference: providerId,
  });
  revalidatePath("/[product]/[[...slug]]", "page");
  redirect(back);
}

/**
 * Screen 3.3p — take a provider off this Request.
 *
 * Deletes only the `whitbyos_provider_options` link. The directory provider
 * stays; if they were filed to the client they return to Related.
 */
export async function detachRequestProvider(formData: FormData) {
  await stopIfReadOnly();

  const requestId = String(formData.get("request_id") ?? "").trim();
  const optionId = String(formData.get("option_id") ?? "").trim();
  const back = `/whitbyos/requests/${requestId}/providers`;

  if (!requestId) redirect(LIST);
  if (!optionId) redirect(back);

  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) redirect(LIST);

  const supabase = await createClient();
  const { data: request } = await supabase
    .from("whitbyos_requests")
    .select("id")
    .eq("id", requestId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (!request) redirect(LIST);

  const { data: option } = await supabase
    .from("whitbyos_provider_options")
    .select("id, provider_id")
    .eq("id", optionId)
    .eq("request_id", requestId)
    .maybeSingle();

  if (!option) redirect(back);

  const { error } = await supabase
    .from("whitbyos_provider_options")
    .delete()
    .eq("id", optionId)
    .eq("request_id", requestId);

  if (error) redirect(`${back}?error=${encodeURIComponent(error.message)}`);

  await recordTimelineEvent({
    requestId,
    eventType: TIMELINE_EVENT.providerUpdated,
    description: "A provider was taken off this Request",
    sourceReference: (option.provider_id as string) ?? optionId,
  });
  revalidatePath("/[product]/[[...slug]]", "page");
  redirect(back);
}
