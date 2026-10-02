import Link from "next/link";
import { shortDate } from "@/whitbyos/lib/format";
import type { RequestDetail } from "@/whitbyos/lib/request-detail";
import { toggleTaskDone } from "@/whitbyos/tasks/actions";
import { isDone } from "@/whitbyos/lib/task-vocab";
import { ShowMore } from "@/whitbyos/components/ShowMore";
import { ProgressBar } from "@/base/components/ProgressBar";
import { Pill } from "@/base/components/Pill";
import { outreachLabel } from "@/whitbyos/lib/provider-vocab";

const DONE = new Set(["complete", "completed", "done"]);

/*
 * How much of each list the Overview shows before handing over.
 *
 * It was showing all of everything behind a "Show N more", and on a busy
 * Request N was 66, then 387. A summary that can be expanded into the
 * whole of what it summarises is not a summary; it is the full page with a
 * lid. Each of these lists has a screen of its own built for it, with a
 * search box and columns, and the Overview's job is to say enough that you
 * know whether to go there.
 */
const OUTSTANDING = 5;
const OPEN_TASKS = 7;
const PLANS = 3;

function softBorder() {
  return "color-mix(in srgb, var(--chrome-line) 85%, #c5ced8)";
}

function panelStyle(): React.CSSProperties {
  return {
    borderColor: softBorder(),
    background: "var(--surface)",
    boxShadow: "0 1px 2px rgba(31,72,125,.04)",
  };
}

/**
 * Screen 3.3o — the Request's own front page.
 *
 * Two columns: what needs doing on the left, what the Request is on the right.
 * Outstanding Items sits at the top because it is the only part of this screen
 * that is a question rather than a fact.
 */
export function OverviewTab({ request }: { request: RequestDetail }) {
  const openTasks = request.tasks.filter((task) => !DONE.has(task.status.toLowerCase()));
  const doneTasks = request.tasks.filter((task) => DONE.has(task.status.toLowerCase()));
  const here = `/whitbyos/requests/${request.id}`;

  const taskTotal = request.tasks.length;
  const taskDonePct = taskTotal > 0 ? (doneTasks.length / taskTotal) * 100 : 0;
  const stepPct =
    request.stepTotal > 0 ? (request.stepDone / request.stepTotal) * 100 : 0;

  const providers =
    request.providerRows.length > 0
      ? request.providerRows
      : request.providers.map((name) => ({
          optionId: name,
          providerId: "",
          name,
          category: null as string | null,
          outreach: null as string | null,
        }));

  return (
    <div className="flex flex-col gap-5">
      {/* Progress picture */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Tasks done"
          value={`${doneTasks.length}/${taskTotal || 0}`}
          meter={taskDonePct}
          note={openTasks.length ? `${openTasks.length} still open` : "All clear"}
        />
        <StatTile
          label="Plan steps"
          value={
            request.stepTotal > 0
              ? `${request.stepDone}/${request.stepTotal}`
              : "—"
          }
          meter={stepPct}
          note={request.stepTotal > 0 ? "Across linked plans" : "No steps yet"}
        />
        <StatTile
          label="Work plans"
          value={String(request.plans.length)}
          meter={request.plans.length ? Math.min(100, request.plans.length * 20) : 0}
          note={request.plans.length ? "Linked to this request" : "None linked"}
          href={`${here}/work-plans`}
        />
        <StatTile
          label="Outstanding"
          value={String(request.outstanding.length)}
          meter={request.outstanding.length ? Math.min(100, request.outstanding.length * 4) : 0}
          note={request.outstanding.length ? "Needs a look" : "Nothing waiting"}
          warn={request.outstanding.length > 0}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(260px,0.9fr)]">
        <section className="rounded-[12px] border p-5" style={panelStyle()}>
          <div className="mb-3 flex items-baseline justify-between gap-2">
            <h3 className="text-[13.5px] font-semibold">Task progress</h3>
            <span className="text-[11.5px]" style={{ color: "var(--text-quiet)" }}>
              {doneTasks.length} done · {openTasks.length} open
            </span>
          </div>
          <TaskBars done={doneTasks.length} open={openTasks.length} />
        </section>

        <section className="rounded-[12px] border p-5" style={panelStyle()}>
          <div className="mb-3 flex items-baseline justify-between gap-2">
            <h3 className="text-[13.5px] font-semibold">Step progress</h3>
            <span className="text-[11.5px]" style={{ color: "var(--text-quiet)" }}>
              {request.stepTotal > 0
                ? `${Math.round(stepPct)}%`
                : "No plan steps"}
            </span>
          </div>
          <StepRing done={request.stepDone} total={request.stepTotal} />
        </section>
      </div>

      <div className="flex flex-col gap-4 lg:flex-row">
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          {request.outstanding.length > 0 ? (
            <section
              className="relative overflow-hidden rounded-[12px] border px-4 py-4"
              style={{
                background:
                  "linear-gradient(135deg, var(--warning-bg) 0%, var(--surface) 85%)",
                borderColor: "var(--warning-border)",
              }}
            >
              <span
                aria-hidden
                className="absolute inset-y-0 left-0 w-[3px]"
                style={{ background: "var(--warning-fg)" }}
              />
              <div
                className="mb-3 pl-1 text-[13.5px] font-semibold"
                style={{ color: "var(--warning-fg)" }}
              >
                Outstanding items ({request.outstanding.length})
              </div>
              {/*
               * Five, and a way to the rest.
               *
               * This is the Overview: what somebody wants from it is whether
               * there is anything wrong, not every one of seventy-four
               * things that are. "Show 66 more" turned the summary into the
               * list it was meant to summarise, and a number that size next
               * to a button reads as a threat rather than an offer.
               */}
              <div className="pl-1">
                <>
                  {request.outstanding.slice(0, OUTSTANDING).map((item) => (
                    <div
                      key={item.id}
                      className="flex items-start justify-between gap-3 border-b py-2.5 text-[12.5px] last:border-b-0"
                      style={{
                        borderColor: "color-mix(in srgb, var(--warning-border) 70%, transparent)",
                        color: "var(--warning-fg)",
                      }}
                    >
                      <span className="min-w-0 leading-[1.45]">{item.body}</span>
                      <Link
                        href={`/whitbyos/insights?open=${item.id}`}
                        className="shrink-0 font-semibold no-underline"
                        style={{ color: "var(--warning-fg)" }}
                      >
                        Review →
                      </Link>
                    </div>
                  ))}

                  {request.outstanding.length > OUTSTANDING ? (
                    <Link
                      href="/whitbyos/insights"
                      className="block pt-2.5 text-[12.5px] font-semibold no-underline"
                      style={{ color: "var(--warning-fg)" }}
                    >
                      Review all in Insights →
                    </Link>
                  ) : null}
                </>
              </div>
            </section>
          ) : null}

          <Card
            title={`Open tasks (${openTasks.length})`}
            action={{ label: "View all", href: `${here}/tasks` }}
          >
            {openTasks.length === 0 ? (
              <p className="text-[13px]" style={{ color: "var(--text-tertiary)" }}>
                Nothing open on this Request.
              </p>
            ) : (
              <>
                {openTasks.slice(0, OPEN_TASKS).map((task) => {
                  const overdue = task.dueDate ? new Date(task.dueDate) < new Date() : false;
                  return (
                    <div
                      key={task.id}
                      className="flex items-center justify-between gap-3 border-b py-2.5 first:pt-0 last:border-b-0"
                      style={{ borderColor: "var(--chrome-line)" }}
                    >
                      <form action={toggleTaskDone} className="flex min-w-0 items-center gap-2">
                        <input type="hidden" name="task_id" value={task.id} />
                        <button
                          type="submit"
                          aria-label={isDone(task.status) ? "Reopen task" : "Mark complete"}
                          className="flex h-[15px] w-[15px] shrink-0 items-center justify-center rounded-[3px] border"
                          style={{
                            borderColor: "var(--border-strong)",
                            background: isDone(task.status) ? "var(--accent)" : "var(--surface)",
                          }}
                        />
                        <span className="min-w-0 truncate text-[13.5px]">{task.title}</span>
                      </form>
                      <span
                        className="shrink-0 text-[12px] font-medium"
                        style={{
                          color: overdue ? "var(--danger-text, #b3261e)" : "var(--text-tertiary)",
                        }}
                      >
                        {overdue
                          ? "Overdue"
                          : task.dueDate
                            ? `Due ${shortDate(task.dueDate)}`
                            : "No date"}
                      </span>
                    </div>
                  );
                })}

                {/* The Tasks tab is a table with a search box and an owner
                    against every row. Reproducing 393 of them here, six at a
                    time, is that page built badly inside a summary. */}
                {openTasks.length > OPEN_TASKS ? (
                  <Link
                    href={`${here}/tasks`}
                    className="block pt-2.5 text-[12.5px] font-medium no-underline"
                    style={{ color: "var(--accent)" }}
                  >
                    Open all tasks →
                  </Link>
                ) : null}
              </>
            )}
          </Card>

          <Card title="Notes" action={{ label: "View all", href: `${here}/notes` }}>
            {request.notes.length === 0 ? (
              <p className="text-[13px]" style={{ color: "var(--text-tertiary)" }}>
                Nothing written down yet.
              </p>
            ) : (
              <p
                className="whitespace-pre-wrap text-[13px] leading-[1.7]"
                style={{ color: "var(--text-secondary)" }}
              >
                {request.notes[0]!.body}
              </p>
            )}
          </Card>

          <Card title="Incoming events this week">
            {request.eventsThisWeek.length === 0 ? (
              <p className="text-[13px]" style={{ color: "var(--text-tertiary)" }}>
                Nothing on the calendar this week.
              </p>
            ) : (
              <ShowMore step={5}>
                {request.eventsThisWeek.map((event) => (
                  <div
                    key={event.id}
                    className="border-b py-2 text-[12.5px] last:border-b-0"
                    style={{
                      borderColor: "var(--chrome-line)",
                      color: "var(--text-secondary)",
                    }}
                  >
                    {event.startAt ? `${weekday(event.startAt)} · ` : ""}
                    {event.title}
                    {event.startAt ? `, ${timeOf(event.startAt)}` : ""}
                  </div>
                ))}
              </ShowMore>
            )}
          </Card>
        </div>

        <aside className="flex w-full shrink-0 flex-col gap-4 lg:w-[300px]">
          <Card title="Key dates">
            <Line>Created {shortDate(request.createdAt)}</Line>
            {request.targetDate ? <Line>Target {shortDate(request.targetDate)}</Line> : null}
            {request.closedAt ? <Line>Closed {shortDate(request.closedAt)}</Line> : null}
          </Card>

          <Card title="Contacts">
            {request.people.length === 0 ? (
              <Line muted>Nobody named on this Request yet.</Line>
            ) : (
              request.people.map((person, index) => (
                <Line key={`${person.name}-${index}`}>
                  {person.name}, {person.role}
                </Line>
              ))
            )}
          </Card>

          <Card
            title="Providers"
            action={{ label: "Manage →", href: `${here}/providers` }}
          >
            {providers.length === 0 ? (
              <Line muted>No providers linked yet.</Line>
            ) : (
              <ShowMore step={5}>
                {providers.map((row) => {
                  const body = (
                    <span className="flex min-w-0 flex-col gap-0.5 py-2">
                      <span className="truncate text-[13px] font-medium" style={{ color: "var(--ink)" }}>
                        {row.name}
                      </span>
                      <span className="flex flex-wrap items-center gap-1.5 text-[11.5px]" style={{ color: "var(--text-tertiary)" }}>
                        {row.category ? <span>{row.category}</span> : null}
                        {"outreach" in row && row.outreach ? (
                          <Pill tone="neutral">{outreachLabel(row.outreach)}</Pill>
                        ) : null}
                      </span>
                    </span>
                  );

                  return row.providerId ? (
                    <Link
                      key={row.optionId}
                      href={`/whitbyos/providers/${row.providerId}`}
                      className="block border-b no-underline last:border-b-0"
                      style={{ borderColor: "var(--chrome-line)" }}
                    >
                      {body}
                    </Link>
                  ) : (
                    <div
                      key={row.optionId}
                      className="border-b last:border-b-0"
                      style={{ borderColor: "var(--chrome-line)" }}
                    >
                      {body}
                    </div>
                  );
                })}
              </ShowMore>
            )}
          </Card>

          <Card
            title="Linked"
            action={{ label: "+ New Work Plan", href: "/whitbyos/work-plans/new" }}
          >
            <Line>
              Client:{" "}
              {request.clientName ?? (
                <span style={{ color: "var(--text-tertiary)" }}>None</span>
              )}
            </Line>
            {request.plans.length === 0 ? (
              <Line muted>No Work Plan yet.</Line>
            ) : (
              <>
                {/* The three most recent by name, so the card says which
                    plans these are rather than only how many. A count on
                    its own is a thing to click, not a thing to read. */}
                {request.plans.slice(0, PLANS).map((plan) => (
                  <Link
                    key={plan.id}
                    href={`/whitbyos/work-plans/${plan.id}`}
                    className="block truncate py-[3px] text-[12.5px] no-underline"
                    style={{ color: "var(--ink)" }}
                    title={plan.name}
                  >
                    {plan.name}
                  </Link>
                ))}

                <Link
                  href={`${here}/work-plans`}
                  className="block py-[3px] text-[12.5px] no-underline"
                  style={{ color: "var(--accent)" }}
                >
                  {request.plans.length > PLANS ? "All Work Plans →" : "Open Work Plans →"}
                </Link>
              </>
            )}
          </Card>
        </aside>
      </div>
    </div>
  );
}

function StatTile({
  label,
  value,
  meter,
  note,
  href,
  warn,
}: {
  label: string;
  value: string;
  meter: number;
  note: string;
  href?: string;
  warn?: boolean;
}) {
  const inner = (
    <>
      <span
        className="text-[11px] font-semibold uppercase tracking-[0.04em]"
        style={{ color: warn ? "var(--warning-fg)" : "var(--text-quiet)" }}
      >
        {label}
      </span>
      <span className="text-[20px] font-bold tracking-[-0.3px]">{value}</span>
      <ProgressBar value={meter} tone={warn ? "default" : "success"} />
      <span className="text-[11.5px]" style={{ color: "var(--text-tertiary)" }}>
        {note}
      </span>
    </>
  );

  const className =
    "flex flex-col gap-1.5 rounded-[12px] border px-4 py-3.5 no-underline";
  const style = { ...panelStyle(), color: "inherit" as const };

  return href ? (
    <Link href={href} className={className} style={style}>
      {inner}
    </Link>
  ) : (
    <div className={className} style={style}>
      {inner}
    </div>
  );
}

function TaskBars({ done, open }: { done: number; open: number }) {
  const total = done + open;
  if (total === 0) {
    return (
      <p className="py-8 text-center text-[13px]" style={{ color: "var(--text-tertiary)" }}>
        No tasks on this request yet.
      </p>
    );
  }

  const max = Math.max(done, open, 1);
  return (
    <div className="flex flex-col gap-3">
      {[
        { label: "Done", count: done, color: "var(--success-fg)" },
        { label: "Open", count: open, color: "var(--accent)" },
      ].map((row) => (
        <div key={row.label}>
          <div className="mb-1 flex justify-between text-[12px]">
            <span style={{ color: "var(--text-muted)" }}>{row.label}</span>
            <span className="font-semibold tabular-nums">{row.count}</span>
          </div>
          <div
            className="h-2.5 overflow-hidden rounded-full"
            style={{ background: "var(--surface-soft)" }}
          >
            <div
              className="h-full rounded-full"
              style={{
                width: `${(row.count / max) * 100}%`,
                background: row.color,
                minWidth: row.count > 0 ? 6 : 0,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function StepRing({ done, total }: { done: number; total: number }) {
  if (total === 0) {
    return (
      <div className="flex h-[120px] items-center justify-center">
        <span className="text-[12.5px]" style={{ color: "var(--text-tertiary)" }}>
          Link a work plan to track steps
        </span>
      </div>
    );
  }

  const size = 112;
  const stroke = 12;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.min(1, done / total);
  const filled = pct * c;

  return (
    <div className="flex items-center gap-4">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden className="shrink-0">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--surface-soft)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--accent)"
          strokeWidth={stroke}
          strokeDasharray={`${filled} ${c - filled}`}
          strokeDashoffset={c / 4}
          strokeLinecap="round"
        />
        <text
          x="50%"
          y="48%"
          textAnchor="middle"
          dominantBaseline="central"
          style={{ fontSize: 18, fontWeight: 700, fill: "var(--ink)" }}
        >
          {Math.round(pct * 100)}%
        </text>
        <text
          x="50%"
          y="62%"
          textAnchor="middle"
          dominantBaseline="central"
          style={{ fontSize: 9, fill: "var(--text-tertiary)" }}
        >
          complete
        </text>
      </svg>
      <div className="text-[12.5px]" style={{ color: "var(--text-muted)" }}>
        <div className="font-semibold" style={{ color: "var(--ink)" }}>
          Step {done} of {total}
        </div>
        <div className="mt-1">Across linked work plans</div>
      </div>
    </div>
  );
}

function Card({
  title,
  action,
  children,
}: {
  title: string;
  action?: { label: string; href: string };
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[12px] border px-4 py-4" style={panelStyle()}>
      <div className="mb-2.5 flex items-center justify-between gap-3">
        <span className="text-[13.5px] font-semibold tracking-[-0.1px]">{title}</span>
        {action ? (
          <Link
            href={action.href}
            className="text-[12px] font-medium no-underline"
            style={{ color: "var(--accent)" }}
          >
            {action.label}
          </Link>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function Line({ children, muted }: { children: React.ReactNode; muted?: boolean }) {
  return (
    <div
      className="py-[3px] text-[12.5px]"
      style={{ color: muted ? "var(--text-tertiary)" : "var(--text-secondary)" }}
    >
      {children}
    </div>
  );
}

function weekday(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { weekday: "short" });
}

function timeOf(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}
