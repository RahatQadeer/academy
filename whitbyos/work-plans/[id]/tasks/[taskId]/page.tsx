import { Bin } from "@/whitbyos/components/Bin";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Pill } from "@/base/components/Pill";
import { SubmitPlain } from "@/base/components/Submit";
import { OwnerAvatar } from "@/whitbyos/components/OwnerAvatar";
import { BackLink } from "@/whitbyos/components/BackLink";
import { shortDate } from "@/whitbyos/lib/format";
import {
  getTaskEdit,
  getWorkPlan,
  listAssignees,
  listDependencyOptions,
  type PlanTask,
  type PlanWorkstream,
} from "@/whitbyos/lib/work-plans";
import { EditTaskDialog } from "@/whitbyos/work-plans/[id]/components/EditTaskDialog";
import { WhitbyDraftCard } from "@/whitbyos/work-plans/[id]/components/WhitbyDraftCard";
import { PLAN_CHIP, streamInk, streamTint } from "@/whitbyos/lib/plan-ink";
import {
  askClientForRequirements,
  dropClientNeed,
  toggleChecklistItem,
  toggleTask,
} from "@/whitbyos/work-plans/actions";
import { ContactsPanel, planResources } from "@/whitbyos/work-plans/[id]/components/ContactsPanel";
import { getClientAsk } from "@/whitbyos/lib/client-ask";
import { peopleOnTask, stepsLabel } from "@/whitbyos/lib/task-people";
import {
  answeredNeeds,
  clientNeeds,
  needFieldId,
  needSlug,
  requirementState,
  saysWhoProvides,
} from "@/whitbyos/lib/plan-requirements";

const DONE = new Set(["complete", "completed", "done"]);

const REQUIREMENT_LABEL: Record<string, string> = {
  document: "Document",
  information: "Information",
  approval: "Approval",
  account: "Account or access",
  contact: "Contact",
};

/**
 * The kind pill's colour, taken from what is known about the item rather than
 * from its kind. A green pill on everything not yet marked held was the visual
 * half of the same untrue claim the words made.
 */
const REQUIREMENT_TONE = {
  success: "success",
  waiting: "warning",
  neutral: "neutral",
  none: "neutral",
} as const;

/**
 * WP.18 read-side — a task, open, as the person doing it needs it.
 *
 * Until now the only way into a task was the Edit dialog: a form for changing
 * a title and a date, with the briefing squeezed above it. So everything
 * Whitby had worked out about how to do the work — what it needs first, what
 * it produces, who to ring, and the steps themselves — was reachable only by
 * going to change something.
 *
 * Reading and editing are different acts. This is the reading one. Edit is a
 * button on it.
 */
export default async function TaskDetailPage({
  planId,
  taskId,
  searchParams,
}: {
  planId: string;
  taskId: string;
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const plan = await getWorkPlan(planId);
  if (!plan) notFound();

  /**
   * What the client has been asked for, so each requirement below can say
   * something true.
   *
   * Read from the ask's own responses rather than from a column: see
   * `plan-requirements.ts` for why nothing on this side records receipt.
   */
  const { ask, edits, proposals } = await getClientAsk(planId);
  const needState = {
    asked: ask !== null,
    /* A suggestion the client has not sent back is not an answer. Same
       rule as the plan's rail and the checklist panel. */
    answered: answeredNeeds(clientNeeds(plan.workstreams, edits), ask?.responses, {
      proposals,
      submitted: Boolean(ask?.submittedAt),
    }),
    guessing: !saysWhoProvides(plan.workstreams),
    skipped: new Set(edits.skip ?? []),
  };

  const streamIndex = plan.workstreams.findIndex((stream) =>
    stream.tasks.some((task) => task.id === taskId),
  );
  const stream = plan.workstreams[streamIndex];
  const task = stream?.tasks.find((row) => row.id === taskId);
  if (!stream || !task) notFound();

  const planPath = `/whitbyos/work-plans/${planId}`;
  const streamPath = `${planPath}/streams/${stream.id}`;
  const here = `${planPath}/tasks/${taskId}`;

  /**
   * Edit opens over the task, not on the plan.
   *
   * It used to link to `<plan>?task=<id>`, so pressing it left the task you
   * were reading, and saving put you on the plan rather than back where you
   * were. The dialog is the same dialog; only where it is opened from and
   * where it closes to have changed.
   */
  const editing =
    (Array.isArray(searchParams?.edit) ? searchParams?.edit[0] : searchParams?.edit) === "1";
  const editError = Array.isArray(searchParams?.error)
    ? searchParams?.error[0]
    : searchParams?.error;

  const edit = editing
    ? {
        task: await getTaskEdit(taskId),
        assignees: await listAssignees(),
        dependencies: await listDependencyOptions(plan, taskId),
      }
    : null;

  const done = DONE.has(task.status.toLowerCase());
  const steps = task.checklist ?? [];
  const ticked = steps.filter((item) => item.done).length;

  // Whatever this one task sends somebody to, in the same shape the plan's
  // own rail uses.
  const contacts = planResources([task]);

  /**
   * Everybody this task takes, and which steps are theirs.
   *
   * A task has one owner, and some genuinely take two people — one arranges
   * access and another attends, one drafts and another approves. The steps
   * carry that: a step whose owner is not the task's is somebody else's piece.
   * Listed by first appearance, so the order on the screen is the order the
   * work happens in.
   */
  const shares = new Map<
    string,
    { name: string; initials: string; hasPhoto: boolean; steps: number[] }
  >();

  // The rule itself lives in `task-people`, because Screen 7 asks the same
  // question of the same rows and used to answer it differently — one avatar
  // over a task three people are on.
  for (const person of peopleOnTask(task.ownerUserId, steps)) {
    const from = steps.find((item) => item.ownerUserId === person.userId);
    const name = from?.ownerName ?? task.ownerName;
    if (!name) continue;

    shares.set(person.userId, {
      name,
      initials: from?.ownerInitials ?? task.ownerInitials ?? "?",
      hasPhoto: from?.ownerHasPhoto ?? task.ownerHasPhoto,
      steps: person.steps,
    });
  }

  const shared = shares.size > 1;

  const blocker = task.blockedByTaskId
    ? plan.workstreams
        .flatMap((row) => row.tasks)
        .find((row) => row.id === task.blockedByTaskId)
    : null;
  const blockingStream = task.blockedByStreamId
    ? plan.workstreams.find((row) => row.id === task.blockedByStreamId)
    : null;

  return (
    <div className="mx-auto w-full max-w-[1100px] px-6 py-6">
      {/* Back to the Work Stream the task lives in, which is one level up.
          The breadcrumb under it reaches the plan in the same click. */}
      <BackLink href={streamPath} label={`Back to ${stream.name}`} />

      <div className="mb-4 flex flex-wrap items-center gap-2 text-[12.5px]">
        <Link href={planPath} className="no-underline" style={{ color: "var(--text-tertiary)" }}>
          {plan.name}
        </Link>
        <span style={{ color: "var(--text-disabled)" }}>/</span>
        <Link href={streamPath} className="no-underline" style={{ color: "var(--text-tertiary)" }}>
          {stream.name}
        </Link>
      </div>

      <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
        <h1 className="min-w-0 text-[24px] font-bold" style={{ margin: 0, color: "var(--ink)" }}>
          {task.title}
        </h1>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <form action={toggleTask}>
            <input type="hidden" name="plan_id" value={planId} />
            <input type="hidden" name="task_id" value={task.id} />
            <SubmitPlain
              className="rounded-control px-4 py-[9px] text-[13.5px] font-medium"
              style={
                done
                  ? { border: "1px solid var(--border-strong)", color: "var(--ink)" }
                  : { background: "var(--success-fg)", color: "#fff" }
              }
            >
              {done ? "Reopen task" : "✓ Mark complete"}
            </SubmitPlain>
          </form>

          <Link
            href={`${here}?edit=1`}
            scroll={false}
            className="rounded-control border px-4 py-[9px] text-[13.5px] font-medium no-underline"
            style={{ borderColor: "var(--border-strong)", color: "var(--ink)" }}
          >
            Edit task
          </Link>
        </div>
      </div>

      {/* The same summary shape the plan uses: the readings that answer "where
          is this" in one bounded block, rather than three loose rows. */}
      <div
        className="mb-6 flex flex-wrap items-center gap-x-5 gap-y-3 rounded-card border border-line bg-surface px-4 py-3"
        style={{ boxShadow: "0 1px 2px rgba(15,15,15,.04)" }}
      >
        <StatusChip status={task.status} />

        <Link
          href={streamPath}
          className="rounded px-[7px] py-0.5 text-[11.5px] font-medium no-underline"
          style={{ background: streamTint(streamIndex), color: streamInk(streamIndex) }}
        >
          {stream.name}
        </Link>

        {task.kind === "approval" ? <Pill tone="warning">Needs approval</Pill> : null}

        {steps.length > 0 ? (
          <span className="flex min-w-[160px] flex-1 items-center gap-3">
            <span
              className="h-[6px] min-w-[80px] flex-1 overflow-hidden rounded-[3px]"
              style={{ background: "var(--canvas)" }}
            >
              <span
                className="block h-full rounded-[3px]"
                style={{
                  width: `${Math.round((ticked / steps.length) * 100)}%`,
                  background:
                    ticked === steps.length ? "var(--success-fg)" : streamInk(streamIndex),
                }}
              />
            </span>
            <span
              className="shrink-0 whitespace-nowrap text-[12.5px]"
              style={{ color: "var(--text-secondary)", fontVariantNumeric: "tabular-nums" }}
            >
              {ticked} of {steps.length} steps
            </span>
          </span>
        ) : null}

        <span
          className="text-[12.5px]"
          style={{ color: "var(--text-tertiary)", fontVariantNumeric: "tabular-nums" }}
        >
          {task.due_date ? `Due ${shortDate(task.due_date)}` : "No due date"}
        </span>
      </div>

      <div className="flex flex-col gap-6 lg:flex-row">
        <div className="flex min-w-0 flex-1 flex-col gap-5">
          {task.description ? (
            <p
              className="text-[14.5px] leading-[1.6]"
              style={{ margin: 0, color: "var(--ink)" }}
            >
              {task.description}
            </p>
          ) : null}

          {/* What Whitby already did, above the steps.
              Somebody opening one of these tasks is asking how to finish it,
              and on a task Whitby classified as its own work the honest answer
              is that a first pass exists and the job is to check it. Putting
              the steps first would have them start the work a second time. */}
          {task.whitbyDraft ? (
            <WhitbyDraftCard
              draft={task.whitbyDraft}
              draftedAt={task.whitbyDraftAt}
              planId={planId}
              taskId={task.id}
              returnTo={`${planPath}/tasks/${task.id}`}
            />
          ) : null}

          {/* The steps, first and largest. This is the answer to "how do I
              finish this", which is why somebody opened the task. */}
          <Section
            title="Steps to complete this"
            count={steps.length > 0 ? `${ticked} of ${steps.length} done` : undefined}
          >
            {shared ? (
              <div
                className="flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-line px-4 py-3"
                style={{ background: "var(--surface-soft)" }}
              >
                <span
                  className="text-[11px] font-semibold uppercase tracking-[.05em]"
                  style={{ color: "var(--text-tertiary)" }}
                >
                  {shares.size} people on this task
                </span>

                {[...shares.entries()].map(([userId, person]) => (
                  <span key={userId} className="flex items-center gap-2">
                    <OwnerAvatar
                      name={person.name}
                      initials={person.initials}
                      userId={userId}
                      hasPhoto={person.hasPhoto}
                      size={20}
                    />
                    <span className="text-[12.5px]" style={{ color: "var(--ink)" }}>
                      {person.name}
                    </span>
                    <span
                      className="text-[12px]"
                      style={{ color: "var(--text-tertiary)", fontVariantNumeric: "tabular-nums" }}
                    >
                      {stepsLabel(person.steps)}
                    </span>
                  </span>
                ))}
              </div>
            ) : null}

            {steps.length === 0 ? (
              <Empty>
                No steps written for this task yet. Add them from Edit task.
              </Empty>
            ) : (
              <ol className="flex flex-col" style={{ margin: 0, padding: 0 }}>
                {steps.map((item, index) => (
                  <li
                    key={index}
                    className="flex items-start gap-3 border-b border-line px-4 py-3 last:border-b-0"
                    style={{ listStyle: "none" }}
                  >
                    <form action={toggleChecklistItem} className="shrink-0 pt-px">
                      <input type="hidden" name="plan_id" value={planId} />
                      <input type="hidden" name="task_id" value={task.id} />
                      <input type="hidden" name="index" value={index} />
                      <SubmitPlain
                        aria-label={item.done ? `Untick ${item.text}` : `Tick ${item.text}`}
                        title={item.done ? "Mark not done" : "Mark done"}
                        className="flex h-[17px] w-[17px] items-center justify-center rounded-[5px] border-2 text-[11px]"
                        style={
                          item.done
                            ? {
                                borderColor: "var(--success-fg)",
                                background: "var(--success-fg)",
                                color: "#fff",
                              }
                            : { borderColor: "var(--border-strong)" }
                        }
                      >
                        {item.done ? "✓" : ""}
                      </SubmitPlain>
                    </form>

                    <span
                      className="min-w-0 flex-1 text-[13.5px] leading-[1.5]"
                      style={
                        item.done
                          ? { color: "var(--text-tertiary)", textDecoration: "line-through" }
                          : { color: "var(--ink)" }
                      }
                    >
                      <span
                        className="mr-2 text-[11.5px] font-semibold"
                        style={{ color: "var(--text-disabled)" }}
                      >
                        {index + 1}
                      </span>
                      {item.text}
                    </span>

                    {/* Only where it differs from the task's own owner: a face
                        on every step of a task one person is doing is noise. */}
                    {shared && item.ownerName ? (
                      <span className="shrink-0 pt-px" title={item.ownerName}>
                        <OwnerAvatar
                          name={item.ownerName}
                          initials={item.ownerInitials ?? "?"}
                          userId={item.ownerUserId ?? null}
                          hasPhoto={item.ownerHasPhoto ?? false}
                          size={20}
                        />
                      </span>
                    ) : null}
                  </li>
                ))}
              </ol>
            )}
          </Section>

          {contacts.length > 0 ? (
            <Section title="Where to go" count="numbers and links for this step">
              <div className="p-4">
                <ContactsPanel entries={contacts} />
              </div>
            </Section>
          ) : null}

          {/* The firm this needs and does not have.
              A step saying "appoint a property valuation provider" is not an
              instruction until somebody knows what kind of firm and why — and
              it is also a gap in the directory, which is why the way to fill
              it is on the same card. */}
          {task.providerNeed ? (
            <Section title="Outside firm needed">
              <div className="flex flex-wrap items-start justify-between gap-4 p-4">
                <span className="min-w-0">
                  <span
                    className="block text-[13.5px] font-medium"
                    style={{ color: "var(--ink)" }}
                  >
                    {task.providerNeed.category}
                  </span>
                  {task.providerNeed.why ? (
                    <span
                      className="mt-1 block text-[12.5px] leading-[1.5]"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      {task.providerNeed.why}
                    </span>
                  ) : null}
                  <span
                    className="mt-1.5 block text-[12px]"
                    style={{ color: "var(--text-tertiary)" }}
                  >
                    Nobody in your Providers matches this yet.
                  </span>
                </span>

                <Link
                  href="/whitbyos/providers?new=1"
                  className="shrink-0 rounded-control border px-3.5 py-2 text-[12.5px] font-medium no-underline"
                  style={{ borderColor: "var(--accent)", color: "var(--accent)" }}
                >
                  Add a provider
                </Link>
              </div>
            </Section>
          ) : null}

          {task.requiredInputs.length > 0 ? (
            <Section title="Needed before this can start">
              {task.requiredInputs.map((input, index) => {
                const slug = needSlug(input.label ?? "");
                const onForm = Boolean(ask?.fieldIds.has(needFieldId(slug)));
                const answered = Boolean(needState?.answered.has(slug));

                /* Only what the client can give. The ask is a form on the
                   plan, so it needs a plan, which this page always has. */
                const askable = input.from === "client" && slug.length > 0;

                return (
                <div
                  key={index}
                  className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-2.5 text-[13px] last:border-b-0"
                >
                  <Pill tone={REQUIREMENT_TONE[requirementState(input, needState)?.tone ?? "none"]}>
                    {REQUIREMENT_LABEL[input.kind] ?? input.kind}
                  </Pill>
                  <span style={{ color: "var(--ink)" }}>{input.label}</span>
                  {/* What the work wants it for. Whoever does this step is the
                      one the client asks, so they should not have to guess. */}
                  {input.why ? (
                    <span style={{ color: "var(--text-tertiary)" }}>&mdash; {input.why}</span>
                  ) : null}
                  {/* Only ever what is actually established. This used to read
                      "not held yet" beside anything whose `alreadyHeld` was not
                      true, which nothing had checked and nothing could change. */}
                  {(() => {
                    const state = requirementState(input, needState);
                    if (!state) return null;
                    return (
                      <span
                        style={{
                          color:
                            state.tone === "success"
                              ? "var(--success-fg)"
                              : state.tone === "waiting"
                                ? "var(--danger-fg)"
                                : "var(--text-tertiary)",
                        }}
                      >
                        {state.text}
                      </span>
                    );
                  })()}

                  {/*
                   * The same ask the plan's panel sends, from the row where
                   * the need is being read.
                   *
                   * It was on the other task page and not this one. Two
                   * screens draw this list: `/whitbyos/tasks/[id]` and this,
                   * the one you reach from inside a plan, which is the one
                   * somebody working a plan actually opens. So the row said
                   * "not asked for yet" and gave no way to ask.
                   */}
                  {askable && !answered ? (
                    <form className="ml-auto flex shrink-0 items-center gap-1">
                      <input type="hidden" name="plan_id" value={planId} />
                      <input type="hidden" name="return_to" value={here} />
                      <input type="hidden" name="ask" value={slug} />

                      {onForm ? (
                        <span
                          className="rounded-control px-2.5 py-1 text-[12px] font-medium"
                          style={{ background: "var(--surface-soft)", color: "var(--text-quiet)" }}
                        >
                          Asked
                        </span>
                      ) : (
                        <SubmitPlain
                          formAction={askClientForRequirements}
                          className="inline-flex items-center gap-1.5 rounded-control border px-2.5 py-1 text-[12px] font-medium"
                          style={{ borderColor: "var(--accent)", color: "var(--accent)" }}
                        >
                          Approve and send
                        </SubmitPlain>
                      )}

                      {/*
                       * And a way to decide it should not be asked at all.
                       *
                       * Whitby works these out from the plan, so some of them
                       * are wrong: something the firm already holds, or that
                       * this client does not need. Without this the only
                       * answer to a wrong row was to send it to the client
                       * anyway. It takes it off the list and off the form if
                       * it had already reached one, which is why it is the
                       * plan's own action rather than a second route to the
                       * same table.
                       */}
                      <SubmitPlain
                        formAction={dropClientNeed.bind(null, slug)}
                        title="Take this off the list"
                        aria-label={`Take ${input.label} off the list`}
                        className="inline-flex items-center rounded-control px-1.5 leading-none transition-colors hover:text-[var(--danger-fg)]"
                        style={{ color: "var(--text-quiet)" }}
                      >
                        <Bin />
                      </SubmitPlain>
                    </form>
                  ) : null}
                </div>
                );
              })}
            </Section>
          ) : null}

          {task.expectedOutput ? (
            <Section title="What this produces">
              <p className="px-4 py-3 text-[13.5px] leading-[1.55]" style={{ margin: 0 }}>
                {task.expectedOutput}
              </p>
            </Section>
          ) : null}

          {task.rationale ? (
            <Section title="Why this is in the plan">
              <p
                className="px-4 py-3 text-[13.5px] leading-[1.55]"
                style={{ margin: 0, color: "var(--text-secondary)" }}
              >
                {task.rationale}
              </p>
            </Section>
          ) : null}
        </div>

        <aside className="flex w-full shrink-0 flex-col gap-4 lg:w-[290px]">
          <Panel title="Assigned to">
            {task.ownerName ? (
              <div className="flex items-center gap-2.5">
                <OwnerAvatar
                  name={task.ownerName}
                  initials={task.ownerInitials ?? "?"}
                  userId={task.ownerUserId}
                  hasPhoto={task.ownerHasPhoto}
                  size={30}
                />
                <span className="min-w-0">
                  <span className="block truncate text-[13.5px] font-medium" style={{ color: "var(--ink)" }}>
                    {task.ownerName}
                  </span>
                  <span className="block text-[12px]" style={{ color: "var(--text-tertiary)" }}>
                    {done ? "Completed this" : "Responsible for this task"}
                  </span>
                </span>
              </div>
            ) : (
              <span style={{ color: "var(--warning-fg)" }}>
                Nobody yet. Assign it from Edit task.
              </span>
            )}
          </Panel>

          <Panel title="Dates">
            {task.startDate ? <Line>Planned start {shortDate(task.startDate)}</Line> : null}
            <Line>{task.due_date ? `Due ${shortDate(task.due_date)}` : "No due date"}</Line>
            {task.estimatedDays ? (
              <Line>
                Estimated {task.estimatedDays} working day{task.estimatedDays === 1 ? "" : "s"}
              </Line>
            ) : null}
            {task.completed_at ? <Line>Completed {shortDate(task.completed_at)}</Line> : null}
          </Panel>

          {blocker || blockingStream ? (
            <Panel title="Waiting on">
              {blockingStream ? (
                <Line>
                  <Link href={`${planPath}/streams/${blockingStream.id}`}>
                    {blockingStream.name}
                  </Link>
                </Line>
              ) : null}
              {blocker ? (
                <Line>
                  <Link href={`${planPath}/tasks/${blocker.id}`}>{blocker.title}</Link>
                </Line>
              ) : null}
            </Panel>
          ) : null}

        </aside>
      </div>

      {edit?.task ? (
        <EditTaskDialog
          planId={planId}
          task={edit.task}
          briefing={task}
          streams={plan.workstreams}
          assignees={edit.assignees}
          dependencies={edit.dependencies}
          planTargetDate={plan.target_date ? plan.target_date.slice(0, 10) : null}
          closeHref={here}
          error={editError}
        />
      ) : null}
    </div>
  );
}

function Section({
  title,
  count,
  children,
}: {
  title: string;
  count?: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-2.5 flex flex-wrap items-baseline gap-2">
        <h2 className="text-[14px] font-semibold" style={{ color: "var(--ink)" }}>
          {title}
        </h2>
        {count ? (
          <span className="text-[12.5px]" style={{ color: "var(--text-tertiary)" }}>
            {count}
          </span>
        ) : null}
      </div>
      <div className="overflow-hidden rounded-card border border-line bg-surface">{children}</div>
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="px-4 py-6 text-center text-[13px]"
      style={{ margin: 0, color: "var(--text-tertiary)" }}
    >
      {children}
    </p>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-[8px] border border-line p-4">
      <div className="mb-2.5 text-[13px] font-semibold">{title}</div>
      <div className="text-[12.5px] leading-[1.8]" style={{ color: "var(--text-secondary)" }}>
        {children}
      </div>
    </div>
  );
}

function Line({ children }: { children: React.ReactNode }) {
  return <div>{children}</div>;
}

function StatusChip({ status }: { status: string }) {
  const key = status.toLowerCase();
  const chip = DONE.has(key)
    ? { label: "Complete", ...PLAN_CHIP.complete }
    : key === "waiting"
      ? { label: "Waiting", ...PLAN_CHIP.waiting }
      : key === "in_progress" || key === "running"
        ? { label: "Running", ...PLAN_CHIP.running }
        : { label: "Not Started", ...PLAN_CHIP.planned };

  return (
    <span
      className="rounded px-2 py-0.5 text-[11.5px] font-medium"
      style={{ background: chip.bg, color: chip.fg }}
    >
      {chip.label}
    </span>
  );
}

export type { PlanTask, PlanWorkstream };

