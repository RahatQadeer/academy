/**
 * Whose work an Ask Whitby question is about, decided from the sentence and
 * from the client already on the bar — no database, so the rule can be tested
 * as a rule.
 */

const DONE = new Set(["complete", "completed", "done"]);

function isDone(status: string) {
  return DONE.has(status.toLowerCase());
}

export type NamedClient = { id: string; name: string };

export type AskScope =
  | { kind: "client"; client: NamedClient }
  | { kind: "all"; clients: NamedClient[] };

export type BriefTask = {
  id: string;
  title: string;
  status: string;
  due: string | null;
  nextAction: string | null;
  planId: string | null;
  planName: string | null;
  requestTitle: string | null;
  clientId: string | null;
  clientName: string | null;
  href: string;
};

export type BriefPlan = {
  id: string;
  name: string;
  status: string;
  health: string | null;
  target: string | null;
  requestTitle: string | null;
  clientName: string | null;
  done: number;
  total: number;
  next: BriefTask | null;
};

export type BriefRequest = {
  id: string;
  title: string;
  status: string;
  clientName: string | null;
};

const CLOSED_REQUEST = new Set(["complete", "completed", "closed", "cancelled"]);

function startOfDay(date: Date) {
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
}

export function daysFromToday(value: string | null, now = new Date()) {
  if (!value) return null;
  const due = new Date(value);
  if (Number.isNaN(due.getTime())) return null;
  return Math.round((startOfDay(due) - startOfDay(now)) / 86_400_000);
}

export function duePhrase(value: string | null, status: string, now = new Date()) {
  if (isDone(status)) return "done";
  const diff = daysFromToday(value, now);
  if (diff === null) return "no due date";
  if (diff < 0) {
    const late = -diff;
    return late === 1 ? "1 day overdue" : `${late} days overdue`;
  }
  if (diff === 0) return "due today";
  if (diff === 1) return "due tomorrow";
  return `due ${value!.slice(0, 10)}`;
}

export function openTasks(tasks: BriefTask[]) {
  return tasks
    .filter((task) => !isDone(task.status))
    .sort((a, b) => {
      const ad = a.due ? new Date(a.due).getTime() : Number.MAX_SAFE_INTEGER;
      const bd = b.due ? new Date(b.due).getTime() : Number.MAX_SAFE_INTEGER;
      return ad - bd;
    });
}

function namedInQuestion(question: string, clients: NamedClient[]) {
  const q = question.toLowerCase();
  const hits = clients.filter((client) => q.includes(client.name.toLowerCase()));
  if (hits.length === 0) return null;
  return hits.sort((a, b) => b.name.length - a.name.length)[0] ?? null;
}

/**
 * A name in the sentence wins, so "Whitfield Estate" still opens that family
 * when another client is on the bar. Otherwise the open client is the subject
 * — "his workplan" is that person. With nobody open, the whole firm.
 */
export function resolveAskScope({
  question,
  clients,
  openClient,
}: {
  question: string;
  clients: NamedClient[];
  openClient: NamedClient | null;
}): AskScope {
  const named = namedInQuestion(question, clients);
  if (named) return { kind: "client", client: named };
  if (openClient) return { kind: "client", client: openClient };
  return { kind: "all", clients };
}

export function withoutEmDashes(value: string) {
  return value
    .replace(/\u2014/g, ",")
    .replace(/\u2013/g, "-")
    .replace(/\s+,/g, ",")
    .replace(/,(\S)/g, ", $1");
}

export type AnswerSection = {
  heading: string;
  bullets: string[];
};

export type AnswerDraft = {
  lead: string;
  sections: AnswerSection[];
};

function tidyDraft(draft: AnswerDraft): AnswerDraft {
  return {
    lead: withoutEmDashes(draft.lead.trim()),
    sections: draft.sections
      .map((section) => ({
        heading: withoutEmDashes(section.heading.trim()),
        bullets: section.bullets.map((bit) => withoutEmDashes(bit.trim())).filter(Boolean),
      }))
      .filter((section) => section.heading || section.bullets.length > 0),
  };
}

/**
 * A readable answer from the rows themselves, for when the model is down or
 * the brief is small enough that composing it is the honest thing.
 */
/**
 * Why Whitby could not answer, said the way a person would say it.
 *
 * The provider's own messages are accurate and useless to read: "Model
 * request failed (429)" tells somebody who asked about a passport nothing
 * they can act on. These say what happened and what to do.
 */
export function unansweredReason(error: string | null | undefined): string {
  const said = String(error ?? "").toLowerCase();

  if (said.includes("no model is configured")) {
    return "no AI model is set up for this workspace";
  }
  if (said.includes("took too long")) {
    return "the model took too long to answer";
  }
  if (said.includes("429") || said.includes("rate") || said.includes("quota")) {
    return "the model is rate limiting us at the moment";
  }
  if (said.includes("could not reach")) {
    return "the model could not be reached";
  }
  return "the model did not answer";
}

export function fallbackAnswer(
  brief: {
    scopeLabel: string;
    plans: BriefPlan[];
    tasks: BriefTask[];
    requests: BriefRequest[];
  },
  /**
   * Set where this is standing in for an answer rather than being one.
   *
   * Every failure of the model call used to return this draft unchanged, and
   * it is written to sound like an answer: "For Rohail Khan, the next work is
   * X, three days overdue." Asked whether a passport had come back, during an
   * outage, that is fluent, on topic, confidently wrong, and indistinguishable
   * on screen from a real reply.
   *
   * The rows below it are real and worth keeping, so the draft stays. What
   * changes is the first line, which stops claiming to have answered.
   */
  unanswered?: string | null,
): AnswerDraft {
  const next = openTasks(brief.tasks);
  const overdue = next.filter((task) => {
    const diff = daysFromToday(task.due);
    return diff !== null && diff < 0;
  });
  const dueToday = next.filter((task) => daysFromToday(task.due) === 0);
  const openRequests = brief.requests.filter(
    (row) => !CLOSED_REQUEST.has(row.status.toLowerCase()),
  );

  let lead: string;
  if (unanswered) {
    /* Said first and said plainly. The sections below are still the real
       state of the work, which is why they are still drawn. */
    lead = `I could not answer that, because ${unanswered}. Nothing here is an answer to your question. What is on file for ${brief.scopeLabel} is below, and asking again in a moment usually works.`;
  } else if (next[0]) {
    const task = next[0];
    const where = task.planName ? ` on ${task.planName}` : "";
    const action = task.nextAction ? ` Next action: ${task.nextAction}.` : "";
    lead = `For ${brief.scopeLabel}, the next work is "${task.title}"${where}, ${duePhrase(task.due, task.status)}.${action}`;
  } else if (brief.plans.length > 0) {
    lead = `${brief.scopeLabel} has ${brief.plans.length} work plan${brief.plans.length === 1 ? "" : "s"}, and no open tasks on them yet.`;
  } else {
    lead = `${brief.scopeLabel} has no live work plans on file. Whitby can still look at requests, people and the calendar from what is loaded below.`;
  }

  const sections: AnswerSection[] = [];
  if (overdue.length > 0) {
    sections.push({
      heading: "Overdue",
      bullets: overdue.slice(0, 8).map((task) => {
        const plan = task.planName ? ` (${task.planName})` : "";
        return `${task.title}${plan}, ${duePhrase(task.due, task.status)}`;
      }),
    });
  }
  if (dueToday.length > 0) {
    sections.push({
      heading: "Due today",
      bullets: dueToday.map((task) => {
        const plan = task.planName ? ` (${task.planName})` : "";
        return `${task.title}${plan}`;
      }),
    });
  }
  const coming = next.filter((task) => !overdue.includes(task) && !dueToday.includes(task)).slice(0, 5);
  if (coming.length > 0) {
    sections.push({
      heading: "Coming next",
      bullets: coming.map((task) => {
        const plan = task.planName ? ` (${task.planName})` : "";
        return `${task.title}${plan}, ${duePhrase(task.due, task.status)}`;
      }),
    });
  }
  const facts: string[] = [];
  if (brief.plans.length > 0) {
    facts.push(
      brief.plans.length === 1 ? "1 work plan is open" : `${brief.plans.length} work plans are open`,
    );
  }
  if (openRequests.length > 0) {
    facts.push(
      openRequests.length === 1
        ? "1 request is active"
        : `${openRequests.length} requests are active`,
    );
  }
  if (facts.length > 0) {
    sections.push({ heading: "Also open", bullets: facts });
  }

  return tidyDraft({ lead, sections });
}

export function fallbackLead(brief: {
  scopeLabel: string;
  plans: BriefPlan[];
  tasks: BriefTask[];
  requests: BriefRequest[];
}): string {
  const draft = fallbackAnswer(brief);
  return [draft.lead, ...draft.sections.flatMap((section) => section.bullets)].join("\n\n");
}
