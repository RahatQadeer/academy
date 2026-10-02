import { createClient } from "@/base/lib/supabase/server";
import { getCurrentWorkspaceId } from "@/whitbyos/lib/workspace";
import { getOpenClient } from "@/whitbyos/lib/open-client";
import { generateJson, isAiConfigured } from "@/whitbyos/lib/ai/provider";
import { roleLabel } from "@/whitbyos/lib/contact-vocab";
import { listClientGmailContext } from "@/whitbyos/lib/gmail-context";
import { listKnowledgeForDraft } from "@/whitbyos/lib/knowledge";
import { isDone, taskStatusLabel } from "@/whitbyos/lib/task-vocab";
import {
  duePhrase,
  fallbackAnswer,
  openTasks,
  resolveAskScope,
  unansweredReason,
  withoutEmDashes,
  type AnswerDraft,
  type AskScope,
  type BriefPlan,
  type BriefRequest,
  type BriefTask,
  type NamedClient,
} from "@/whitbyos/lib/ask-scope";

/**
 * Screen 1.0c — Ask Whitby anything.
 *
 * The professional is already looking at somebody's work: the open client, or
 * every client at once. The answer has to be that work — plans, tasks, people,
 * the calendar — not a guess at whose name was in the sentence. A question
 * like "what is next in his workplan" with Rohail Khan open is about Rohail
 * Khan, even though it never says so.
 *
 * The model writes the lead from a brief of real rows. The cards under it are
 * those same rows, so a name on the screen is always a name in the tables.
 */

export type AnswerGroup = {
  heading: string;
  rows: { id: string; label: string; detail: string | null; href: string | null; glyph: string }[];
};

/**
 * A create still being filled in across turns — name, client, request, etc.
 * Stored on the whitby message's `answer` jsonb so the next reply can continue
 * without a separate draft table.
 */
export type AskPendingAction = {
  intent:
    | "create_work_plan"
    | "create_task"
    | "create_client"
    | "create_request"
    | "create_group"
    | "add_person"
    | "send_message";
  slots: {
    name?: string | null;
    clientName?: string | null;
    requestChoice?: string | null;
    assigneeNames?: string | null;
    dueDate?: string | null;
    description?: string | null;
    contactName?: string | null;
    contactEmail?: string | null;
    classification?: string | null;
    recipientName?: string | null;
    messageBody?: string | null;
    planName?: string | null;
  };
  /** Messages need an explicit yes before anything is sent (SRS §1.15). */
  awaitingConfirm?: boolean;
};

export type Answer = {
  lead: string;
  sections: { heading: string; bullets: string[] }[];
  groups: AnswerGroup[];
  /** The one thing worth opening after reading, if there is one. */
  open: { label: string; href: string } | null;
  /** Said plainly when nothing could be matched, rather than an empty screen. */
  note: string | null;
  /** When Whitby is mid-create and waiting on the next answer. */
  pending?: AskPendingAction | null;
};

/**
 * Plain text for a chat bubble: lead, then headed bullet blocks.
 *
 * Flattening into one space-joined sentence was how Ask Whitby on a Work Plan
 * lost every line break and every heading the model had already written.
 */
export function formatAskReply(answer: Answer): string {
  if (answer.note && !answer.lead && answer.sections.length === 0) {
    return answer.note;
  }

  const blocks: string[] = [];
  if (answer.lead.trim()) blocks.push(answer.lead.trim());

  for (const section of answer.sections) {
    const lines: string[] = [];
    if (section.heading.trim()) lines.push(section.heading.trim());
    for (const bullet of section.bullets) {
      const bit = bullet.trim();
      if (bit) lines.push(`• ${bit}`);
    }
    if (lines.length > 0) blocks.push(lines.join("\n"));
  }

  if (blocks.length === 0 && answer.note) return answer.note;
  return blocks.join("\n\n");
}

export type { NamedClient, AskScope } from "@/whitbyos/lib/ask-scope";
export { resolveAskScope, fallbackLead } from "@/whitbyos/lib/ask-scope";

type BriefPerson = {
  id: string;
  name: string;
  detail: string | null;
  href: string;
  glyph: string;
};

type BriefEvent = {
  id: string;
  title: string;
  when: string | null;
  clientName: string | null;
};

type AskBrief = {
  scopeLabel: string;
  plans: BriefPlan[];
  tasks: BriefTask[];
  requests: BriefRequest[];
  people: BriefPerson[];
  providers: BriefPerson[];
  events: BriefEvent[];
  emails: { id: string; label: string; detail: string; href: string }[];
  knowledge: { id: string; title: string; detail: string; body: string | null }[];
};

const ANSWER_SCHEMA = {
  type: "object",
  properties: {
    lead: { type: "string" },
    sections: {
      type: "array",
      items: {
        type: "object",
        properties: {
          heading: { type: "string" },
          bullets: { type: "array", items: { type: "string" } },
        },
        required: ["heading", "bullets"],
      },
    },
  },
  required: ["lead", "sections"],
};

function firstOf<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function fullNameOf(row: {
  first_name?: string | null;
  last_name?: string | null;
  preferred_name?: string | null;
}) {
  return (
    row.preferred_name ||
    [row.first_name, row.last_name].filter(Boolean).join(" ") ||
    "Unnamed contact"
  );
}

function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

function taskHref(task: { id: string; planId: string | null }) {
  return task.planId
    ? `/whitbyos/work-plans/${task.planId}/tasks/${task.id}`
    : `/whitbyos/tasks?task=${task.id}`;
}

function groupsFrom(brief: AskBrief): AnswerGroup[] {
  const groups: AnswerGroup[] = [];
  const next = openTasks(brief.tasks);

  if (brief.plans.length > 0) {
    groups.push({
      heading: "Work Plans",
      rows: brief.plans.slice(0, 8).map((plan) => ({
        id: plan.id,
        label: plan.name,
        detail: [
          plan.total > 0 ? `${plan.done}/${plan.total}` : null,
          plan.next ? `next: ${plan.next.title}` : "no open tasks",
          plan.clientName && brief.plans.some((row) => row.clientName !== plan.clientName)
            ? plan.clientName
            : null,
        ]
          .filter(Boolean)
          .join(" · "),
        href: `/whitbyos/work-plans/${plan.id}`,
        glyph: "❖",
      })),
    });
  }

  if (next.length > 0) {
    groups.push({
      heading: "Next tasks",
      rows: next.slice(0, 8).map((task) => ({
        id: task.id,
        label: task.title,
        detail: [duePhrase(task.due, task.status), task.planName, task.clientName]
          .filter(Boolean)
          .join(" · "),
        href: task.href,
        glyph: "☑",
      })),
    });
  }

  if (brief.requests.length > 0) {
    groups.push({
      heading: "Requests",
      rows: brief.requests.slice(0, 8).map((row) => ({
        id: row.id,
        label: row.title,
        detail: [row.status.replace(/_/g, " "), row.clientName].filter(Boolean).join(" · "),
        href: `/whitbyos/requests/${row.id}`,
        glyph: "☰",
      })),
    });
  }

  if (brief.people.length > 0) {
    groups.push({
      heading: "People",
      rows: brief.people.slice(0, 8).map((row) => ({
        id: row.id,
        label: row.name,
        detail: row.detail,
        href: row.href,
        glyph: row.glyph,
      })),
    });
  }

  if (brief.providers.length > 0) {
    groups.push({
      heading: "Providers",
      rows: brief.providers.slice(0, 8).map((row) => ({
        id: row.id,
        label: row.name,
        detail: row.detail,
        href: row.href,
        glyph: "◫",
      })),
    });
  }

  if (brief.events.length > 0) {
    groups.push({
      heading: "Coming up",
      rows: brief.events.slice(0, 6).map((row) => ({
        id: row.id,
        label: row.title,
        detail: [row.when?.slice(0, 16).replace("T", " "), row.clientName]
          .filter(Boolean)
          .join(" · "),
        href: "/whitbyos/calendar",
        glyph: "▦",
      })),
    });
  }

  if (brief.emails.length > 0) {
    groups.push({
      heading: "Email",
      rows: brief.emails.map((row) => ({
        id: row.id,
        label: row.label,
        detail: row.detail,
        href: row.href,
        glyph: "\u2709",
      })),
    });
  }

  if (brief.knowledge.length > 0) {
    groups.push({
      heading: "Knowledge Base",
      rows: brief.knowledge.slice(0, 6).map((row) => ({
        id: row.id,
        label: row.title,
        detail: row.detail,
        href: `/whitbyos/knowledge/${row.id}`,
        glyph: "▣",
      })),
    });
  }

  return groups;
}

function packBrief(brief: AskBrief) {
  const lines: string[] = [`SCOPE: ${brief.scopeLabel}`, ""];

  if (brief.plans.length === 0) lines.push("WORK PLANS: none");
  else {
    lines.push("WORK PLANS:");
    for (const plan of brief.plans.slice(0, 12)) {
      const next = plan.next
        ? `next task "${plan.next.title}" (${duePhrase(plan.next.due, plan.next.status)})`
        : "no open task";
      lines.push(
        `- ${plan.name} | ${plan.done}/${plan.total} done | ${plan.status}${plan.health ? ` | ${plan.health}` : ""}${plan.target ? ` | target ${plan.target.slice(0, 10)}` : ""} | ${next}${plan.clientName ? ` | client ${plan.clientName}` : ""}`,
      );
    }
  }

  const next = openTasks(brief.tasks).slice(0, 20);
  lines.push("");
  if (next.length === 0) lines.push("OPEN TASKS: none");
  else {
    lines.push("OPEN TASKS (soonest first):");
    for (const task of next) {
      lines.push(
        `- "${task.title}" | ${taskStatusLabel(task.status)} | ${duePhrase(task.due, task.status)}${task.nextAction ? ` | next action: ${task.nextAction}` : ""}${task.planName ? ` | plan ${task.planName}` : ""}${task.requestTitle ? ` | request ${task.requestTitle}` : ""}${task.clientName ? ` | client ${task.clientName}` : ""}`,
      );
    }
  }

  lines.push("");
  if (brief.requests.length === 0) lines.push("REQUESTS: none");
  else {
    lines.push("REQUESTS:");
    for (const row of brief.requests.slice(0, 12)) {
      lines.push(
        `- ${row.title} | ${row.status.replace(/_/g, " ")}${row.clientName ? ` | ${row.clientName}` : ""}`,
      );
    }
  }

  if (brief.people.length > 0) {
    lines.push("", "PEOPLE:");
    for (const row of brief.people.slice(0, 12)) {
      lines.push(`- ${row.name}${row.detail ? ` (${row.detail})` : ""}`);
    }
  }

  if (brief.providers.length > 0) {
    lines.push("", "PROVIDERS:");
    for (const row of brief.providers.slice(0, 8)) {
      lines.push(`- ${row.name}${row.detail ? ` (${row.detail})` : ""}`);
    }
  }

  if (brief.events.length > 0) {
    lines.push("", "CALENDAR (next two weeks):");
    for (const row of brief.events.slice(0, 10)) {
      lines.push(
        `- ${row.title}${row.when ? ` | ${row.when.slice(0, 16).replace("T", " ")}` : ""}${row.clientName ? ` | ${row.clientName}` : ""}`,
      );
    }
  }

  if (brief.emails.length > 0) {
    lines.push("", "RECENT EMAIL:");
    for (const row of brief.emails) {
      lines.push(`- ${row.label}${row.detail ? ` | ${row.detail}` : ""}`);
    }
  }

  if (brief.knowledge.length > 0) {
    lines.push("", "KNOWLEDGE BASE (firm standards — prefer these over inventing process):");
    for (const row of brief.knowledge.slice(0, 5)) {
      const snippet = row.body
        ? row.body.length > 400
          ? `${row.body.slice(0, 400).trim()}…`
          : row.body.trim()
        : "(uploaded file — title only)";
      lines.push(`- "${row.title}"${row.detail ? ` | ${row.detail}` : ""}: ${snippet}`);
    }
  }

  return lines.join("\n");
}

const ASK_SYSTEM = `You are Whitby, the intelligent coordination layer inside Private Attaché. You advise professionals who run family-office logistics: requests, work plans, tasks, people and the calendar.

Answer from the workspace brief only. Name real plans, tasks, dates, statuses and people. Be specific: which plan, which task is next, what is overdue, what the next action is.

If the brief includes Knowledge Base articles that apply, use them. Prefer firm standards over inventing process, and do not ask again for facts those articles already settle.

If the brief does not contain the answer, say what is missing. Never invent a person, date, document, status or commitment.

Shape:
- lead: one or two short sentences that answer the question.
- sections: two to four groups, each with a short heading and two to five short bullets. One fact per bullet. Do not write a wall of prose.
- When Knowledge Base articles apply, put the firm standard in the lead or in a first section headed "Firm standard", then put live plan or task status in later sections. Do not mash standards and plan stats into one paragraph.

Never use em dashes or en dashes. Use a comma, a colon, or a full stop. No markdown, no preamble such as "Based on the brief".`;

/**
 * The plan or request a question was asked from, named.
 *
 * Reads the path the panel was opened on, the same way the create agent
 * works out which plan a task belongs to. A name rather than an id,
 * because it goes into a sentence in the prompt and an id there is a
 * thing the model has to ignore.
 *
 * Silent on anything else: a question asked from Insights or Reports is
 * about the workspace, which is what the answer already assumes.
 */
async function lookingAt(path: string | null | undefined): Promise<string | null> {
  const at = (path ?? "").split("?")[0]!.split("/").filter(Boolean);
  if (at[0] !== "whitbyos" || !at[1] || !at[2]) return null;
  if (at[1] !== "work-plans" && at[1] !== "requests") return null;
  if (!/^[0-9a-f-]{16,}$/i.test(at[2])) return null;

  const supabase = await createClient();
  const table = at[1] === "work-plans" ? "whitbyos_workplans" : "whitbyos_requests";
  const column = at[1] === "work-plans" ? "name" : "title";

  const { data } = await supabase.from(table).select(column).eq("id", at[2]).maybeSingle();
  const name = (data as Record<string, string> | null)?.[column];
  if (!name) return null;

  return at[1] === "work-plans" ? `the Work Plan "${name}"` : `the Request "${name}"`;
}

/** What the prompt asks for, and what the answer is cut to if it does not. */
const MOST_SECTIONS = 4;
const MOST_BULLETS = 5;
const LEAD_SENTENCES = 2;

/**
 * The first sentences of a lead, where the model wrote an essay.
 *
 * Sentence ends are found rather than characters counted: cutting at a
 * character lands mid-word and reads as a broken answer, which is worse
 * than a long one.
 */
function trimTo(text: string, sentences: number) {
  const parts = text.match(/[^.!?]+[.!?]+(\s|$)/g);
  if (!parts || parts.length <= sentences) return text;
  return parts.slice(0, sentences).join("").trim();
}

async function writeDraft(
  question: string,
  brief: AskBrief,
  workspaceId: string,
  extra?: {
    prior?: { role: "user" | "whitby"; body: string }[];
    images?: { mimeType: string; data: string }[];
    /** The plan or request the question was asked from, where there is one. */
    here?: string | null;
  },
): Promise<AnswerDraft> {
  /*
   * Two fallbacks, and the difference is the whole point.
   *
   * `fallbackAnswer(brief)` is a real answer composed from rows, used where
   * no model was ever going to be asked. `fallbackAnswer(brief, reason)` says
   * it is not an answer, and is what every failure of the call returns. They
   * used to be the same object, so an outage produced a confident sentence
   * about the next open task whatever had been asked.
   */
  if (!isAiConfigured()) {
    return fallbackAnswer(brief, unansweredReason("no model is configured"));
  }

  const history =
    extra?.prior && extra.prior.length > 0
      ? `\n\nEarlier in this chat:\n${extra.prior
          .slice(-6)
          .map((turn) => `${turn.role === "user" ? "Professional" : "Whitby"}: ${turn.body}`)
          .join("\n")}\n`
      : "";

  const seen = extra?.images?.length
    ? "\nThe professional attached an image. Use what you can see in it, then ground the rest of the answer in the workspace brief.\n"
    : "";

  const result = await generateJson<{
    lead?: string;
    sections?: { heading?: string; bullets?: string[] }[];
  }>({
    system: ASK_SYSTEM,
    prompt: `${history}${seen}${
      extra?.here
        ? `The professional is looking at ${extra.here}. Unless the question names something else, answer about that first and keep the rest of the workspace to one short section at the end.\n\n`
        : ""
    }Question: ${question}\n\nWorkspace brief:\n${packBrief(brief)}`,
    schema: ANSWER_SCHEMA,
    workspaceId,
    feature: "ask",
    images: extra?.images,
  });

  if (!result.ok) return fallbackAnswer(brief, unansweredReason(result.error));

  /* A reply with no lead is a reply with nothing in it. The sections it may
     carry are the model's, not the brief's, and showing those under a
     borrowed heading is the hybrid answer this used to produce. */
  if (!result.data.lead?.trim()) {
    return fallbackAnswer(brief, "the model answered with nothing in it");
  }

  const fallback = fallbackAnswer(brief);

  /*
   * The shape the prompt asks for, enforced.
   *
   * It has said "two to four groups, two to five short bullets, do not
   * write a wall of prose" since it was written, and an answer came back
   * with five sections, a dozen bullets and a lead paragraph of six lines.
   * This is read in a four hundred pixel panel beside the work, where a
   * wall is not a long answer, it is an answer nobody reads.
   *
   * Cut rather than rewritten: what survives is the model's own first and
   * best, which is the order it put them in.
   */
  const sections = (result.data.sections ?? [])
    .map((section) => ({
      heading: withoutEmDashes(String(section.heading ?? "").trim()),
      bullets: (section.bullets ?? [])
        .map((bit) => withoutEmDashes(String(bit).trim()))
        .filter(Boolean)
        .slice(0, MOST_BULLETS),
    }))
    .filter((section) => section.heading || section.bullets.length > 0)
    .slice(0, MOST_SECTIONS);

  return {
    lead: trimTo(withoutEmDashes(result.data.lead.trim()), LEAD_SENTENCES),
    sections: sections.length > 0 ? sections : fallback.sections,
  };
}

async function loadBrief(
  workspaceId: string,
  scope: AskScope,
  question: string,
): Promise<AskBrief> {
  const supabase = await createClient();
  const clientIds =
    scope.kind === "client" ? [scope.client.id] : scope.clients.map((client) => client.id);
  const scopeLabel =
    scope.kind === "client" ? scope.client.name : "every client in this workspace";
  const oneClient = scope.kind === "client" ? scope.client : null;

  const empty: AskBrief = {
    scopeLabel,
    plans: [],
    tasks: [],
    requests: [],
    people: [],
    providers: [],
    events: [],
    emails: [],
    knowledge: [],
  };
  if (clientIds.length === 0) return empty;

  const now = new Date();
  const fortnight = new Date(now.getTime() + 14 * 86_400_000);

  const [plansResult, tasksResult, requestsResult, eventsResult, providersResult] =
    await Promise.all([
      supabase
        .from("whitbyos_workplans")
        .select(
          "id, name, status, urgency, health, target_date, request:whitbyos_requests!request_id (id, title, workspace_id, client_id, client:whitbyos_clients!client_id (id, name))",
        )
        .is("archived_at", null)
        .is("deleted_at", null)
        .order("updated_at", { ascending: false }),
      supabase
        .from("whitbyos_tasks")
        .select(
          "id, title, status, due_date, next_action, priority, client_id, request_id, request:whitbyos_requests!request_id (id, title, client_id, client:whitbyos_clients!client_id (id, name)), client:whitbyos_clients!client_id (id, name), stream:whitbyos_workstreams!workstream_id (id, name, workplan_id, plan:whitbyos_workplans!workplan_id (id, name, deleted_at, archived_at))",
        )
        .eq("workspace_id", workspaceId),
      supabase
        .from("whitbyos_requests")
        .select("id, title, status, client_id, client:whitbyos_clients!client_id (name)")
        .eq("workspace_id", workspaceId)
        .in("client_id", clientIds)
        .order("updated_at", { ascending: false })
        .limit(20),
      (() => {
        let query = supabase
          .from("whitbyos_calendar_events")
          .select(
            "id, title, start_at, linked_client_id, client:whitbyos_clients!linked_client_id (name)",
          )
          .eq("workspace_id", workspaceId)
          .gte("start_at", now.toISOString())
          .lt("start_at", fortnight.toISOString())
          .order("start_at")
          .limit(12);
        if (oneClient) {
          query = query.or(
            `linked_client_id.eq.${oneClient.id},linked_client_id.is.null`,
          );
        }
        return query;
      })(),
      supabase
        .from("whitbyos_providers")
        .select(
          "id, specialty_capability, client_id, contact:contacts!contact_id (first_name, last_name, preferred_name)",
        )
        .in("client_id", clientIds)
        .is("archived_at", null)
        .limit(8),
    ]);

  type PlanJoin = {
    id?: string;
    title?: string;
    workspace_id?: string;
    client_id?: string | null;
    client?: { id?: string; name?: string } | { id?: string; name?: string }[] | null;
  };

  const plans = ((plansResult.data ?? []) as Record<string, unknown>[]).filter((row) => {
    const request = firstOf(row.request as PlanJoin | PlanJoin[] | null);
    if (request?.workspace_id !== workspaceId) return false;
    return Boolean(request.client_id && clientIds.includes(request.client_id));
  });

  type StreamJoin = {
    id?: string;
    name?: string;
    workplan_id?: string | null;
    plan?:
      | { id?: string; name?: string; deleted_at?: string | null; archived_at?: string | null }
      | { id?: string; name?: string; deleted_at?: string | null; archived_at?: string | null }[]
      | null;
  };

  const tasks: BriefTask[] = [];
  for (const row of (tasksResult.data ?? []) as Record<string, unknown>[]) {
    const stream = firstOf(row.stream as StreamJoin | StreamJoin[] | null);
    const plan = firstOf(stream?.plan ?? null);
    if (!plan?.id || plan.deleted_at || plan.archived_at) continue;

    const request = firstOf(
      row.request as
        | { id?: string; title?: string; client_id?: string | null; client?: { id?: string; name?: string } | { id?: string; name?: string }[] | null }
        | null,
    );
    const client = firstOf(
      (row.client as { id?: string; name?: string } | { id?: string; name?: string }[] | null) ??
        request?.client ??
        null,
    );
    const clientId =
      (row.client_id as string | null) ?? request?.client_id ?? client?.id ?? null;
    if (!clientId || !clientIds.includes(clientId)) continue;

    const item: BriefTask = {
      id: row.id as string,
      title: (row.title as string) || "Untitled task",
      status: (row.status as string) || "not_started",
      due: (row.due_date as string | null) ?? null,
      nextAction: (row.next_action as string | null) ?? null,
      planId: plan.id,
      planName: plan.name ?? null,
      requestTitle: request?.title ?? null,
      clientId,
      clientName: client?.name ?? null,
      href: "",
    };
    item.href = taskHref(item);
    tasks.push(item);
  }

  const byPlan = new Map<string, BriefTask[]>();
  for (const task of tasks) {
    if (!task.planId) continue;
    const list = byPlan.get(task.planId) ?? [];
    list.push(task);
    byPlan.set(task.planId, list);
  }

  const briefPlans: BriefPlan[] = plans.map((row) => {
    const request = firstOf(row.request as PlanJoin | PlanJoin[] | null);
    const client = firstOf(request?.client ?? null);
    const onPlan = byPlan.get(row.id as string) ?? [];
    const open = openTasks(onPlan);
    return {
      id: row.id as string,
      name: row.name as string,
      status: (row.status as string) || "active",
      health: (row.health as string | null) ?? null,
      target: (row.target_date as string | null) ?? null,
      requestTitle: request?.title ?? null,
      clientName: client?.name ?? null,
      done: onPlan.filter((task) => isDone(task.status)).length,
      total: onPlan.length,
      next: open[0] ?? null,
    };
  });

  type NamedContact = {
    first_name?: string | null;
    last_name?: string | null;
    preferred_name?: string | null;
  };

  const briefProviders: BriefPerson[] = ((providersResult.data ?? []) as Record<string, unknown>[]).map(
    (row) => {
      const contact = row.contact as unknown as NamedContact[] | NamedContact | null;
      const named = Array.isArray(contact) ? contact[0] : contact;
      const name = named ? fullNameOf(named) : "Unnamed provider";
      return {
        id: row.id as string,
        name,
        detail: (row.specialty_capability as string | null) ?? null,
        href: `/whitbyos/providers/${row.id}`,
        glyph: "◫",
      };
    },
  );

  const people: BriefPerson[] = [];
  if (oneClient) {
    const { data: memberships } = await supabase
      .from("whitbyos_client_members")
      .select("contact_id, role")
      .eq("client_id", oneClient.id)
      .limit(12);

    const roleOf = new Map(
      (memberships ?? []).map((row) => [row.contact_id as string, row.role as string]),
    );
    if (roleOf.size > 0) {
      const { data: contacts } = await supabase
        .from("contacts")
        .select("id, first_name, last_name, preferred_name, title_role")
        .in("id", [...roleOf.keys()])
        .is("archived_at", null);

      for (const row of contacts ?? []) {
        const name = fullNameOf(row);
        people.push({
          id: row.id as string,
          name,
          detail:
            (row.title_role as string | null) ||
            roleLabel(roleOf.get(row.id as string) ?? "") ||
            null,
          href: `/whitbyos/contacts/${row.id}`,
          glyph: initialsOf(name),
        });
      }
    }
  }

  const events: BriefEvent[] = ((eventsResult.data ?? []) as Record<string, unknown>[])
    .filter((row) => {
      const linked = row.linked_client_id as string | null;
      return !linked || clientIds.includes(linked);
    })
    .map((row) => ({
      id: row.id as string,
      title: row.title as string,
      when: (row.start_at as string | null) ?? null,
      clientName: firstOf(row.client as { name?: string } | { name?: string }[] | null)?.name ?? null,
    }));

  let emails: AskBrief["emails"] = [];
  if (oneClient) {
    const rows = await listClientGmailContext(oneClient.id, 4);
    emails = rows.map((row) => ({
      id: row.id,
      label: row.summary || row.facts[0] || "Email update",
      detail: [row.direction === "outgoing" ? "Sent" : row.from, row.at?.slice(0, 10)]
        .filter(Boolean)
        .join(" · "),
      href: `/whitbyos/clients/${oneClient.id}`,
    }));
  }

  /*
   * Knowledge for this Ask scope: org always; a client's own only when the
   * question is about that one client. Across every client we keep the
   * practice library only, so another family's notes do not leak into the
   * answer. Only articles that touch the question — the whole library would
   * drown every answer in SOPs that do not apply.
   */
  const knowledgeRows = await listKnowledgeForDraft(oneClient?.id ?? null);
  const tokens = question
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 4);

  const scored = knowledgeRows
    .map((row) => {
      const hay = [row.title, row.category ?? "", row.type === "write" ? (row.body ?? "") : ""]
        .join(" ")
        .toLowerCase();
      const score = tokens.reduce((n, token) => (hay.includes(token) ? n + 1 : n), 0);
      return { row, score };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 6)
    .map((entry) => entry.row);

  const knowledge: AskBrief["knowledge"] = scored.map((row) => ({
    id: row.id,
    title: row.title,
    detail: [row.category, row.scope === "client" ? row.clientName : "Organization"]
      .filter(Boolean)
      .join(" · "),
    body:
      row.type === "write" && row.body && !/^https?:\/\//i.test(row.body) ? row.body : null,
  }));

  return {
    scopeLabel,
    plans: briefPlans,
    tasks,
    requests: ((requestsResult.data ?? []) as Record<string, unknown>[]).map((row) => ({
      id: row.id as string,
      title: row.title as string,
      status: (row.status as string) || "open",
      clientName: firstOf(row.client as { name?: string } | { name?: string }[] | null)?.name ?? null,
    })),
    people,
    providers: briefProviders,
    events,
    emails,
    knowledge,
  };
}

export async function askWhitby(
  question: string,
  extra?: {
    prior?: { role: "user" | "whitby"; body: string }[];
    images?: { mimeType: string; data: string }[];
    /** Continue a create that started on an earlier turn. */
    pending?: AskPendingAction | null;
    /** So a create can open that client as the selected workspace. */
    threadId?: string | null;
    /**
     * The route the question was asked from.
     *
     * The panel opens over whatever screen somebody is working on, and
     * "add a task" there means a task on the thing in front of them. The
     * page knows which thing it is; nothing else does.
     */
    path?: string | null;
  },
): Promise<Answer> {
  /*
   * A question asked in the middle of a create is answered, and the create
   * survives it.
   *
   * The pending lives on the last thing Whitby said, so a plain answer —
   * which carries none — would end the create silently: the next turn would
   * find nothing half-finished and start again from the top. The agent says
   * when it has stepped aside on purpose, and it is put back here.
   */
  let carry: AskPendingAction | null = null;
  const answer = await answerWhitby(question, {
    ...extra,
    onQuestionDuringCreate: (pending) => {
      carry = pending;
    },
  });
  return carry && !answer.pending ? { ...answer, pending: carry } : answer;
}

async function answerWhitby(
  question: string,
  extra?: {
    prior?: { role: "user" | "whitby"; body: string }[];
    images?: { mimeType: string; data: string }[];
    pending?: AskPendingAction | null;
    threadId?: string | null;
    path?: string | null;
    onQuestionDuringCreate?: (pending: AskPendingAction) => void;
  },
): Promise<Answer> {
  const empty = (note: string): Answer => ({
    lead: "",
    sections: [],
    groups: [],
    open: null,
    note,
    pending: null,
  });

  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) return empty("No workspace is open.");

  /*
   * Create path first. "Make a work plan for …" is not a lookup — Whitby
   * asks for the missing slots (name, client, request / none, assignees)
   * and then writes the row. Ordinary questions fall through below.
   */
  const { runAskAgent } = await import("@/whitbyos/lib/ask-agent");
  const acted = await runAskAgent(question, {
    prior: extra?.prior,
    pending: extra?.pending,
    images: extra?.images,
    threadId: extra?.threadId,
    path: extra?.path,
    onQuestionDuringCreate: extra?.onQuestionDuringCreate,
  });
  if (acted) return acted;

  const supabase = await createClient();
  const { data: clients } = await supabase
    .from("whitbyos_clients")
    .select("id, name")
    .eq("workspace_id", workspaceId)
    .is("archived_at", null);

  const list = (clients ?? []) as NamedClient[];
  if (list.length === 0) {
    return empty(
      "There are no clients in this workspace yet. Ask me to create a client, or add one from Clients.",
    );
  }

  const openClient = await getOpenClient();
  let scope = resolveAskScope({
    question,
    clients: list,
    openClient: openClient ? { id: openClient.id, name: openClient.name } : null,
  });

  // With nobody open and no name in the question, try matching a client the
  // model can see, "the relocation family", and otherwise keep every client.
  if (scope.kind === "all" && isAiConfigured()) {
    const guess = await generateJson<{ clientName: string }>({
      system:
        "You match a question to one client from a list. Answer with the client's exact name from the list, or an empty string if the question is about more than one of them or about the firm as a whole. Never invent a name. Never use em dashes.",
      prompt: `Clients: ${list.map((c) => c.name).join(", ")}\n\nQuestion: ${question}`,
      schema: {
        type: "object",
        properties: { clientName: { type: "string" } },
        required: ["clientName"],
      },
      workspaceId,
      feature: "ask",
    });
    const named = guess.ok ? guess.data.clientName?.trim().toLowerCase() : "";
    const hit = named ? list.find((client) => client.name.toLowerCase() === named) : null;
    if (hit) scope = { kind: "client", client: hit };
  }

  /*
   * What the professional is looking at.
   *
   * Asked a question from the panel on a Work Plan, Whitby answered about
   * the whole workspace: twelve plans, nine requests, every overdue task
   * in the firm. All of it true, none of it what somebody standing on one
   * plan wanted, and the plan they were standing on was in the list
   * somewhere.
   *
   * The path already tells us. It is not a filter on the brief, because
   * "how does this compare to the others" is a fair question from here
   * too, so the answer is told where it is being asked from and left to
   * lead with it.
   */
  const here = await lookingAt(extra?.path);

  const brief = await loadBrief(workspaceId, scope, question);
  const groups = groupsFrom(brief);
  const draft = await writeDraft(question, brief, workspaceId, { ...extra, here });

  return {
    lead: draft.lead,
    sections: draft.sections,
    groups,
    open:
      scope.kind === "client"
        ? { label: `Open ${scope.client.name} →`, href: `/whitbyos/clients/${scope.client.id}` }
        : { label: "Open work plans →", href: "/whitbyos/work-plans" },
    note: groups.length === 0 && !draft.lead ? `Nothing on file yet for ${brief.scopeLabel}.` : null,
  };
}
