import Link from "next/link";
import { notFound } from "next/navigation";
import { Logo } from "@/base/components/Logo";
import { PrintButton } from "@/whitbyos/work-plans/[id]/print/PrintButton";
import { getExportExtras, getWorkPlan, type PlanTask } from "@/whitbyos/lib/work-plans";
import { listRefineTurns } from "@/whitbyos/lib/workplan";
import { getWorkspaceMark } from "@/whitbyos/lib/workspace";
import { workstreamStatusLabel } from "@/whitbyos/lib/workstream-status";
import { shortDate } from "@/whitbyos/lib/format";
import { exportQuery, readExportOptions, type ExportOptions } from "@/whitbyos/lib/plan-export";

const DONE = new Set(["complete", "completed", "done"]);

/** What WP.24's header calls the layout it was exported in. */
const LAYOUT_LABEL: Record<ExportOptions["layout"], string> = {
  list: "List",
  table: "Table",
  timeline: "Timeline",
};

/**
 * WP.24 — the Work Plan as a document.
 *
 * The reference draws this as a preview with a Download PDF on it, and that is
 * what it is: a page laid out for paper, which the browser turns into a PDF
 * itself. No library generates it, which is why the text stays text — findable,
 * selectable, and readable by anything that opens the file.
 *
 * Everything WP.22 asked for is read off the URL, so an export is a link: it
 * survives a refresh, it can be sent to somebody else, and it comes out the
 * same when they open it. Reached with no query at all — from a bookmark, or
 * the address bar — it falls back to WP.22's own defaults rather than an empty
 * page.
 *
 * The bar across the top is screen-only. What prints is the document.
 */
export default async function WorkPlanPrintPage({
  planId,
  searchParams,
}: {
  planId: string;
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const plan = await getWorkPlan(planId);
  if (!plan) notFound();

  const options = readExportOptions(searchParams);

  const [mark, extras, turns] = await Promise.all([
    options.letterhead ? getWorkspaceMark() : Promise.resolve(null),
    options.notes && options.streams
      ? getExportExtras(plan.workstreams.map((stream) => stream.id))
      : Promise.resolve(null),
    options.activity ? listRefineTurns(plan.id) : Promise.resolve([]),
  ]);

  const printed = new Date().toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    // WP.24 sets the preview on a darker ground than the app, so the page
    // itself reads as paper rather than as another panel.
    <div className="pa-print-sheet min-h-screen py-8" style={{ background: "#e4e4e1" }}>
      <div className="pa-print-hide mx-auto mb-3.5 flex w-full max-w-[900px] flex-wrap items-center gap-3 px-6">
        <Link
          href={`/whitbyos/work-plans/${plan.id}`}
          className="flex items-center gap-1.5 text-[13px] no-underline"
          style={{ color: "var(--ink)" }}
        >
          <span className="text-[15px]">←</span>
          Back to Work Plan
        </Link>

        <span className="text-[12.5px]" style={{ color: "rgba(55,53,47,.55)" }}>
          {plan.name} · Work Plan.pdf
        </span>

        <span className="ml-auto flex items-center gap-2.5">
          {/* Back to WP.22 with this export's answers still in it, so changing
              one does not mean setting all six again. */}
          <Link
            href={`/whitbyos/work-plans/${plan.id}?export=1&${exportQuery(options)}`}
            className="rounded-control border border-line-strong px-4 py-[9px] text-[13.5px] font-medium no-underline"
            style={{ color: "var(--ink)" }}
          >
            Change options
          </Link>
          <a
            href={`/api/whitbyos/work-plans/${plan.id}/export`}
            download
            className="rounded-control border border-line-strong px-4 py-[9px] text-[13.5px] font-medium no-underline"
            style={{ color: "var(--ink)" }}
          >
            Download Markdown
          </a>
          <a
            href={`/api/whitbyos/work-plans/${plan.id}/export?format=pdf&${exportQuery(options)}`}
            download
            className="rounded-control px-4 py-[9px] text-[13.5px] font-medium text-white no-underline"
            style={{ background: "var(--accent)" }}
          >
            Download PDF
          </a>
          <PrintButton />
        </span>
      </div>

      <div className="pa-print-sheet flex justify-center px-6">
        {/* Georgia, because WP.24 sets the document in a serif — a plan on
            paper is read, not scanned, and the app's face is for the screen. */}
        <article
          className="pa-print-page w-full max-w-[900px] bg-surface px-[60px] py-14"
          style={{ boxShadow: "0 4px 24px rgba(15,15,15,.18)", fontFamily: "Georgia, 'Times New Roman', serif" }}
        >
          <header
            className="mb-6 flex items-start justify-between gap-6 pb-3.5"
            style={{ borderBottom: "2px solid var(--ink)" }}
          >
            <div className="min-w-0">
              <div className="text-[11px] uppercase tracking-[0.14em]" style={{ color: "rgba(55,53,47,.45)" }}>
                Work Plan
              </div>
              <div className="mt-1 text-[22px] font-bold leading-tight">{plan.name}</div>
              <div className="mt-1.5 text-[12px]" style={{ color: "rgba(55,53,47,.55)" }}>
                {[
                  mark?.name || plan.client_name,
                  `Generated ${printed}`,
                  `${LAYOUT_LABEL[options.layout]} layout`,
                ].join(" · ")}
              </div>
            </div>

            <Logo size={40} />
          </header>

          {plan.desired_outcome ? (
            <p className="mb-6 text-[13.5px] leading-[1.6]" style={{ color: "var(--text-secondary)" }}>
              {plan.desired_outcome}
            </p>
          ) : null}

          <div className="mb-5 flex items-center gap-3">
            <span
              className="h-1.5 flex-1 overflow-hidden rounded-[3px]"
              style={{ background: "var(--border)" }}
            >
              <span
                className="block h-full rounded-[3px]"
                style={{
                  width: `${plan.progress}%`,
                  background: plan.progress >= 100 ? "var(--success-fg)" : "var(--accent)",
                }}
              />
            </span>
            <span className="shrink-0 text-[11.5px] tabular-nums" style={{ color: "rgba(55,53,47,.55)" }}>
              {plan.taskDone} of {plan.taskTotal} complete · {plan.progress}%
            </span>
          </div>

          <dl
            className="mb-8 grid grid-cols-2 gap-x-8 gap-y-2 border-y border-line py-4 text-[12.5px]"
            style={{ color: "var(--text-secondary)" }}
          >
            <Row label="Status" value={plan.status} />
            <Row label="Owner" value={plan.ownerName} />
            <Row
              label="Target completion"
              value={plan.target_date ? shortDate(plan.target_date) : "Not set"}
            />
            <Row label="Client" value={plan.client_name} />
          </dl>

          {!options.streams ? (
            // The cover page on its own — the plan's shape without its
            // contents, which is what someone sending a status update wants.
            <p className="text-[13.5px]" style={{ color: "var(--text-tertiary)" }}>
              {plan.workstreams.length} Work Stream
              {plan.workstreams.length === 1 ? "" : "s"}, not listed in this export.
            </p>
          ) : plan.workstreams.length === 0 ? (
            <p className="text-[13.5px]" style={{ color: "var(--text-tertiary)" }}>
              This plan has no Work Streams yet.
            </p>
          ) : (
            plan.workstreams.map((stream, index) => (
              <section key={stream.id} className="pa-print-keep mb-6">
                <h2 className="mb-3 flex items-baseline gap-2.5 border-b border-line pb-1.5">
                  <span
                    className="text-[11px] font-semibold tabular-nums"
                    style={{ color: streamInk(stream) }}
                  >
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="min-w-0 flex-1 text-[15px] font-bold">{stream.name}</span>
                  {options.meta ? (
                    <span
                      className="shrink-0 text-[10.5px] font-semibold uppercase tracking-[0.06em]"
                      style={{ color: streamInk(stream) }}
                    >
                      {workstreamStatusLabel(stream.status, stream.blocked)}
                    </span>
                  ) : null}
                </h2>

                {stream.tasks.length === 0 ? (
                  <p className="text-[13.5px]" style={{ color: "var(--text-tertiary)" }}>
                    No tasks yet.
                  </p>
                ) : options.layout === "table" ? (
                  <TaskTable tasks={stream.tasks} options={options} extras={extras} />
                ) : options.layout === "timeline" ? (
                  <TaskTimeline tasks={stream.tasks} options={options} extras={extras} />
                ) : (
                  <TaskList tasks={stream.tasks} options={options} extras={extras} />
                )}

                {extras?.documents.get(stream.id)?.length ? (
                  <div className="mt-2 text-[12.5px]" style={{ color: "var(--text-secondary)" }}>
                    <span className="font-medium">Attached:</span>{" "}
                    {extras.documents.get(stream.id)!.join(" · ")}
                  </div>
                ) : null}
              </section>
            ))
          )}

          {options.activity ? (
            <section className="mt-9 border-t border-line pt-5">
              <h2 className="mb-2.5 text-[13px] font-bold uppercase tracking-[0.04em]">
                Revision history
              </h2>
              {turns.length === 0 ? (
                <p className="text-[13.5px]" style={{ color: "var(--text-tertiary)" }}>
                  This plan has not been revised since it was drafted.
                </p>
              ) : (
                <ol className="flex flex-col gap-2 text-[12.5px]">
                  {turns.map((turn) => (
                    <li key={turn.id} className="flex gap-3">
                      <span
                        className="w-[92px] shrink-0"
                        style={{ color: "var(--text-tertiary)" }}
                      >
                        {shortDate(turn.at)}
                      </span>
                      <span className="min-w-0">
                        {turn.instruction}
                        {turn.changedStreams.length > 0 ? (
                          <span style={{ color: "var(--text-tertiary)" }}>
                            {" "}
                            · {turn.changedStreams.join(", ")}
                          </span>
                        ) : null}
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </section>
          ) : null}

          <footer
            className="mt-10 border-t border-line pt-3.5 text-center text-[11px]"
            style={{ color: "var(--text-disabled)" }}
          >
            {plan.client_name} · {plan.name} · Printed {printed}
          </footer>
        </article>
      </div>
    </div>
  );
}

type Extras = Awaited<ReturnType<typeof getExportExtras>> | null;

type Section = { tasks: PlanTask[]; options: ExportOptions; extras: Extras };

/** WP.22's List — the plan read the way it is worked, one line per task. */
function TaskList({ tasks, options, extras }: Section) {
  return (
    <div className="flex flex-col gap-[3px] text-[13px]">
      {tasks.map((task) => {
        const complete = DONE.has(task.status.toLowerCase());
        return (
          <div key={task.id}>
            {/* Columns, not a sentence strung together with dashes. The owner
                and the date line up down the page, which is what makes a list
                of thirty scannable. */}
            <div className="flex items-baseline gap-2.5">
              <span className="w-3 shrink-0" style={{ color: complete ? "var(--success-fg)" : "rgba(55,53,47,.35)" }}>
                {complete ? "✓" : "☐"}
              </span>
              <span
                className="min-w-0 flex-1 leading-[1.55]"
                style={complete ? { color: "rgba(55,53,47,.55)" } : undefined}
              >
                {task.title}
              </span>
              {options.meta ? (
                <>
                  <span
                    className="w-[112px] shrink-0 truncate text-right text-[11.5px]"
                    style={{ color: "rgba(55,53,47,.5)" }}
                  >
                    {task.ownerName ?? "Unassigned"}
                  </span>
                  <span
                    className="w-[58px] shrink-0 text-right text-[11.5px] tabular-nums"
                    style={{ color: "rgba(55,53,47,.5)" }}
                  >
                    {task.due_date ? shortDate(task.due_date) : "\u2013"}
                  </span>
                </>
              ) : null}
            </div>
            <Notes task={task} extras={extras} />
          </div>
        );
      })}
    </div>
  );
}

/** WP.22's Table — the same tasks where the columns are meant to be compared. */
function TaskTable({ tasks, options, extras }: Section) {
  return (
    <table className="w-full border-collapse text-[12.5px]">
      <thead>
        <tr style={{ color: "var(--text-tertiary)" }}>
          <th className="border-b border-line py-1.5 pr-3 text-left font-medium">Task</th>
          {options.meta ? (
            <>
              <th className="border-b border-line py-1.5 pr-3 text-left font-medium">Owner</th>
              <th className="border-b border-line py-1.5 pr-3 text-left font-medium">Due</th>
              <th className="border-b border-line py-1.5 text-left font-medium">Status</th>
            </>
          ) : null}
        </tr>
      </thead>
      <tbody>
        {tasks.map((task) => (
          <tr key={task.id} className="align-top">
            <td className="border-b border-line py-[7px] pr-3">
              {task.title}
              <Notes task={task} extras={extras} />
            </td>
            {options.meta ? (
              <>
                <td className="border-b border-line py-[7px] pr-3">
                  {task.ownerName ?? "Unassigned"}
                </td>
                <td className="border-b border-line py-[7px] pr-3 tabular-nums">
                  {task.due_date ? shortDate(task.due_date) : "\u2013"}
                </td>
                <td className="border-b border-line py-[7px] capitalize">
                  {task.status.replace(/_/g, " ")}
                </td>
              </>
            ) : null}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/**
 * WP.22's Timeline — the same tasks in date order, grouped by month.
 *
 * Anything without a date is gathered at the end under "No date" rather than
 * being dropped or given one. A plan on paper is often read for what is coming
 * next, and a task nobody has dated is exactly the kind of thing that should
 * be visible while that is being read.
 */
function TaskTimeline({ tasks, options, extras }: Section) {
  const dated = tasks
    .filter((task) => task.due_date)
    .sort((a, b) => String(a.due_date).localeCompare(String(b.due_date)));
  const undated = tasks.filter((task) => !task.due_date);

  const months: Array<{ label: string; tasks: PlanTask[] }> = [];
  for (const task of dated) {
    const label = new Date(task.due_date as string).toLocaleDateString("en-GB", {
      month: "long",
      year: "numeric",
    });
    const last = months[months.length - 1];
    if (last?.label === label) last.tasks.push(task);
    else months.push({ label, tasks: [task] });
  }

  if (undated.length > 0) months.push({ label: "No date", tasks: undated });

  return (
    <div className="flex flex-col gap-3">
      {months.map((month) => (
        <div key={month.label} className="flex gap-4 text-[13px]">
          <div
            className="w-[104px] shrink-0 pt-[3px] text-[11.5px] font-semibold uppercase tracking-[0.04em]"
            style={{ color: "var(--text-tertiary)" }}
          >
            {month.label}
          </div>
          <div className="min-w-0 flex-1 border-l border-line pl-4">
            {month.tasks.map((task) => {
              const complete = DONE.has(task.status.toLowerCase());
              return (
                <div key={task.id} className="mb-1.5 last:mb-0">
                  <div className="flex gap-2.5">
                    {task.due_date ? (
                      <span
                        className="w-[46px] shrink-0 tabular-nums"
                        style={{ color: "var(--text-tertiary)" }}
                      >
                        {new Date(task.due_date).toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "short",
                        })}
                      </span>
                    ) : null}
                    <span className="min-w-0">
                      {complete ? "✓" : "☐"} {task.title}
                      {options.meta && task.ownerName ? (
                        <span style={{ color: "var(--text-tertiary)" }}> · {task.ownerName}</span>
                      ) : null}
                    </span>
                  </div>
                  <Notes task={task} extras={extras} indent />
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

/** What a task carries beyond its title, where WP.22 asked for it. */
function Notes({
  task,
  extras,
  indent,
}: {
  task: PlanTask;
  extras: Extras;
  indent?: boolean;
}) {
  const note = extras?.notes.get(task.id);
  const checklist = extras ? task.checklist : [];
  if (!note && checklist.length === 0) return null;

  return (
    <div
      className={`text-[12px] leading-[1.7] ${indent ? "pl-[57px]" : "pl-4"}`}
      style={{ color: "var(--text-secondary)" }}
    >
      {note?.nextAction ? <div>Next: {note.nextAction}</div> : null}
      {note?.evidence ? <div>Evidence: {note.evidence}</div> : null}
      {checklist.map((item) => (
        <div key={item.text}>
          {item.done ? "✓" : "·"} {item.text}
        </div>
      ))}
    </div>
  );
}

/**
 * The one colour on a Work Stream's heading.
 *
 * The same reading the plan's own screens use, so a stream that is amber on
 * the List is amber on the page somebody prints from it.
 */
function streamInk(stream: { status: string; blocked: boolean }) {
  if (stream.blocked) return "var(--danger-text)";
  if (DONE.has(stream.status.toLowerCase())) return "var(--success-fg)";
  if (stream.status === "waiting") return "var(--warning-fg)";
  if (stream.status === "not_started") return "rgba(55,53,47,.4)";
  return "var(--accent)";
}

function Row({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex gap-2">
      <dt className="shrink-0 font-medium" style={{ color: "var(--ink)" }}>
        {label}:
      </dt>
      <dd className="min-w-0">{value ?? ""}</dd>
    </div>
  );
}
