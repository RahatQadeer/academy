import { inlineLogo } from "@/whitbyos/lib/pdf-logo";
import { renderToStream } from "@react-pdf/renderer";
import { getExportExtras, getWorkPlan } from "@/whitbyos/lib/work-plans";
import { getWorkspaceMark } from "@/whitbyos/lib/workspace";
import { readExportOptions } from "@/whitbyos/lib/plan-export";
import { PlanDocument } from "@/whitbyos/work-plans/[id]/print/document";
import { getClientAsk } from "@/whitbyos/lib/client-ask";
import {
  answeredNeeds,
  clientNeeds,
  saysWhoProvides,
} from "@/whitbyos/lib/plan-requirements";

/** What the document calls the layout it was exported in. */
const LAYOUT_LABEL: Record<string, string> = {
  list: "List",
  table: "Table",
  timeline: "Timeline",
};

const DONE = new Set(["complete", "completed", "done"]);

function line(label: string, value: string | null | undefined) {
  return value ? `- **${label}:** ${value}\n` : "";
}

function date(value: string | null) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? null
    : parsed.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

/**
 * WP.24's Download, in both the forms it is offered in.
 *
 * `?format=pdf` renders the document itself and answers with the file, so the
 * browser puts up its own Save dialog and the person choosing where it goes is
 * the person sending it. Anything else answers with Markdown — the same plan
 * in a form that opens anywhere, pastes into a brief, and is still readable in
 * ten years.
 *
 * getWorkPlan does the workspace check, so a plan that is not this user's
 * returns 404 rather than a file.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const plan = await getWorkPlan(id);
  if (!plan) return new Response("Not found", { status: 404 });

  const query = Object.fromEntries(new URL(request.url).searchParams.entries());
  const slugName =
    plan.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "work-plan";

  if (query.format === "pdf") {
    const options = readExportOptions(query);

    const [mark, extras, askState] = await Promise.all([
      options.letterhead ? getWorkspaceMark() : Promise.resolve(null),
      options.notes && options.streams
        ? getExportExtras(plan.workstreams.map((stream) => stream.id))
        : Promise.resolve(null),
      getClientAsk(plan.id),
    ]);

    /*
     * The same reading the screen has, so the export cannot contradict it.
     *
     * Without this the PDF went on printing "not asked for yet" beside a
     * requirement the professional had taken off the ask, and said nothing
     * about the ones the client had already sent.
     */
    const needs = {
      asked: askState.ask !== null,
      answered: answeredNeeds(
        clientNeeds(plan.workstreams, askState.edits),
        askState.ask?.responses,
      ),
      guessing: !saysWhoProvides(plan.workstreams),
      skipped: new Set(askState.edits.skip ?? []),
    };

    const stream = await renderToStream(
      <PlanDocument
        plan={plan}
        options={options}
        extras={extras}
        letterhead={mark?.name ?? ""}
        initials={mark?.initials ?? ""}
        logo={await inlineLogo(mark?.logoUrl ?? null)}
        printed={new Date().toLocaleDateString("en-GB", {
          day: "numeric",
          month: "long",
          year: "numeric",
        })}
        layoutLabel={LAYOUT_LABEL[options.layout]}
        needs={needs}
      />,
    );

    return new Response(stream as unknown as ReadableStream, {
      headers: {
        "Content-Type": "application/pdf",
        // attachment, so the browser asks where to put it rather than opening
        // one more thing to read on screen.
        "Content-Disposition": `attachment; filename="${slugName}-work-plan.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  }

  let out = `# ${plan.name}\n\n`;
  if (plan.desired_outcome) out += `${plan.desired_outcome}\n\n`;

  out += `## Overview\n\n`;
  out += line("Client", plan.client_name);
  out += line("Request", plan.request_title);
  out += line("Status", plan.status);
  out += line("Urgency", plan.urgency);
  out += line("Health", plan.health.replace(/_/g, " "));
  out += line("Owner", plan.ownerName);
  out += line("Location", plan.location);
  out += line("Target date", date(plan.target_date));
  out += line("Created", date(plan.created_at));
  out += `- **Progress:** ${plan.taskDone} of ${plan.taskTotal} tasks complete (${plan.progress}%)\n`;
  if (plan.playbookName) out += line("From playbook", plan.playbookName);
  out += `\n`;

  out += `## Work Streams\n\n`;
  if (plan.workstreams.length === 0) {
    out += `_No work streams yet._\n`;
  }

  plan.workstreams.forEach((stream, index) => {
    const state = stream.blocked ? "blocked" : stream.status.replace(/_/g, " ");
    out += `### ${index + 1}. ${stream.name}\n\n`;
    if (stream.purpose) out += `${stream.purpose}\n\n`;
    out += `- **Status:** ${state}\n\n`;

    if (stream.tasks.length === 0) {
      out += `_No tasks._\n\n`;
      return;
    }

    for (const task of stream.tasks) {
      const tick = DONE.has(task.status.toLowerCase()) ? "x" : " ";
      const due = date(task.due_date);
      out += `- [${tick}] ${task.title}${due ? ` — due ${due}` : ""}\n`;
    }
    out += `\n`;
  });

  return new Response(out, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="${slugName}.md"`,
    },
  });
}

/**
 * The workspace's own logo, as bytes the renderer can draw.
 *
 * @react-pdf will fetch a remote image itself, but that makes the document
 * depend on a URL being reachable and public at render time — a private bucket
 * or a slow host and the export fails or hangs rather than losing a picture.
 * Fetched here instead, with a ceiling, and the monogram stands in when there
 * is nothing to draw. A letterhead without the mark is still a letterhead.
 */
