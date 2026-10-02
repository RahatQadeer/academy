import { Bin } from "@/whitbyos/components/Bin";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Pill } from "@/base/components/Pill";
import { Button } from "@/base/components/Button";
import { SubmitPlain } from "@/base/components/Submit";
import { BackLink } from "@/whitbyos/components/BackLink";
import { OwnerAvatar } from "@/whitbyos/components/OwnerAvatar";
import { getTask } from "@/whitbyos/lib/tasks";
import { WhitbyDraftCard } from "@/whitbyos/work-plans/[id]/components/WhitbyDraftCard";
import { listAssignees } from "@/whitbyos/lib/work-plans";
import { peopleOnTask, stepsLabel } from "@/whitbyos/lib/task-people";
import { needFieldId, needSlug, requirementState } from "@/whitbyos/lib/plan-requirements";
import { getClientAsk } from "@/whitbyos/lib/client-ask";
import { askClientForRequirements, dropClientNeed } from "@/whitbyos/work-plans/actions";
import { shortDate } from "@/whitbyos/lib/format";
import {
  dueLabel,
  isDone,
  priorityLabel,
  priorityTone,
  taskStatusLabel,
  taskStatusTone,
} from "@/whitbyos/lib/task-vocab";
import { completeTask, toggleTaskStep } from "@/whitbyos/tasks/actions";
import { TaskDetailDialog } from "@/whitbyos/tasks/components/TaskDetailDialog";

const LIST = "/whitbyos/tasks";

const REQUIREMENT_LABEL: Record<string, string> = {
  document: "Document",
  information: "Information",
  approval: "Approval",
  account: "Account or access",
  contact: "Contact",
};

type SearchParams = Record<string, string | string[] | undefined>;

function one(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * A task, open, wherever it came from.
 *
 * Screen 7 opened a dialog of eight fields, and a drafted task carries four
 * times that: its steps, what it needs before it can start, what it produces,
 * why it is in the plan and who to reach. The plan's own task page has shown
 * all of it for weeks, and only a task still attached to a living plan could
 * get there — so the answer to "open this task" depended on which plan it was
 * on and whether that plan had since been deleted.
 *
 * This is the one address every task has. Where a plan is behind it, the page
 * says so and links to it; where drafting wrote nothing, it draws nothing and
 * offers the way to write it rather than a column of empty headings. 154 of
 * this workspace's 269 live tasks are that second kind.
 */
export default async function TaskPage({
  taskId,
  searchParams,
}: {
  taskId: string;
  searchParams?: SearchParams;
}) {
  const task = await getTask(taskId);
  if (!task) notFound();

  /*
   * What this plan has already asked its client for.
   *
   * The same ask the plan's own panel sends, read from the same place, so a
   * need asked for here is asked for there and comes back green on both.
   */
  const { ask, edits } = task.planId
    ? await getClientAsk(task.planId)
    : { ask: null, edits: { extra: [], skip: [] } };

  const needState = ask || task.planId
    ? {
        asked: ask !== null,
        answered: new Set(
          Object.entries(ask?.responses ?? {})
            .filter(([, value]) => value?.trim())
            .map(([key]) => key.replace(/^need-/, "")),
        ),
        guessing: false,
        skipped: new Set(edits.skip ?? []),
      }
    : null;

  const editing = one(searchParams?.edit) === "1";
  const reassign = one(searchParams?.reassign) === "1";
  const assignees = editing || reassign ? await listAssignees() : [];

  const done = isDone(task.status);
  const due = dueLabel(task.due_date, task.status);
  const priority = priorityLabel(task.priority);
  const here = `${LIST}/${task.id}`;

  /*
   * Everybody on the task, from both places somebody can be on one.
   *
   * `peopleOnTask` reads the steps, which is where drafting puts a split. It
   * does not know about assignees, so a task given to two people where neither
   * holds a step of their own came back as one — the second name was on the
   * row and nowhere in the list.
   */
  const holding = peopleOnTask(task.owner_user_id, task.steps);
  const people = [
    ...holding,
    ...task.people
      .filter((person) => !holding.some((one) => one.userId === person.userId))
      .map((person) => ({ userId: person.userId, steps: [], leads: false })),
  ];
  const shared = people.length > 1;
  const ticked = task.steps.filter((step) => step.done).length;

  const briefed =
    task.description ||
    task.rationale ||
    task.expected_output ||
    task.requiredInputs.length > 0 ||
    task.externalLinks.length > 0 ||
    task.providerNeed ||
    task.steps.length > 0;

  return (
    <div className="px-5 py-6 sm:px-8 sm:py-9 xl:px-12">
      <BackLink href={LIST} label="Back to Tasks" />

      <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-[12.5px]" style={{ color: "var(--text-tertiary)", margin: 0 }}>
            {[
              task.request_title,
              task.workstream_name,
            ]
              .filter(Boolean)
              .join(" · ") || "No request"}
          </p>

          <h1
            className="mt-1 text-[22px] font-bold leading-[1.3]"
            style={{ color: "var(--ink)", textDecoration: done ? "line-through" : undefined }}
          >
            {task.title}
          </h1>

          <div className="mt-2.5 flex flex-wrap items-center gap-2 text-[12.5px]">
            <Pill tone={taskStatusTone(task.status)}>{taskStatusLabel(task.status)}</Pill>
            {priority ? <Pill tone={priorityTone(task.priority)}>{priority}</Pill> : null}
            {due ? (
              <span
                className={due.tone === "muted" ? "" : "font-medium"}
                style={{
                  color:
                    due.tone === "danger"
                      ? "var(--danger-fg)"
                      : due.tone === "ink"
                        ? "var(--ink)"
                        : "var(--text-secondary)",
                }}
              >
                {due.text}
                {task.due_date ? ` · ${shortDate(task.due_date)}` : ""}
              </span>
            ) : (
              <span style={{ color: "var(--text-faint)" }}>No date</span>
            )}
            {task.estimated_days ? (
              <span style={{ color: "var(--text-tertiary)" }}>
                {task.estimated_days === 1 ? "1 day of work" : `${task.estimated_days} days of work`}
              </span>
            ) : null}
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Button
            unsized
            href={`${here}?edit=1`}
            variant="secondary"
            className="px-4 py-[9px] text-[13.5px]"
          >
            Edit task
          </Button>

          {done ? null : (
            <form action={completeTask}>
              <input type="hidden" name="task_id" value={task.id} />
              <SubmitPlain
                className="inline-flex items-center justify-center gap-2 rounded-control px-4 py-[9px] text-[13.5px] font-medium"
                style={{ background: "var(--accent)", color: "#fff" }}
              >
                Mark complete
              </SubmitPlain>
            </form>
          )}
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-6 lg:flex-row">
        <div className="min-w-0 flex-1 flex flex-col gap-5">
          {task.description ? (
            <Section title="What this is">
              <p className="px-4 py-3 text-[13.5px] leading-[1.55]" style={{ margin: 0 }}>
                {task.description}
              </p>
            </Section>
          ) : null}

          {/* What Whitby already did, in the same place the plan's own task
              page puts it: above the steps, because on these tasks the first
              pass is the answer to "how do I finish this".

              Gated on `planId` because dismissing posts the plan it belongs
              to. Every draft has one, so this is a type guard rather than a
              rule; a task with a draft and no plan would be a plan that was
              deleted underneath it. */}
          {task.whitbyDraft && task.planId ? (
            <WhitbyDraftCard
              draft={task.whitbyDraft}
              draftedAt={task.whitbyDraftAt}
              planId={task.planId}
              taskId={task.id}
              returnTo={`/whitbyos/tasks/${task.id}`}
            />
          ) : null}

          {/* The steps, tickable. This is the part somebody opens a task to
              work through, and the only screen that had it was the plan's. */}
          <Section
            title={
              task.steps.length === 0
                ? "Steps"
                : `Steps · ${ticked} of ${task.steps.length} done`
            }
          >
            {task.steps.length === 0 ? (
              <p
                className="px-4 py-4 text-[13px]"
                style={{ color: "var(--text-tertiary)", margin: 0 }}
              >
                {/* Only offered where it leads somewhere: steps are written
                    in the plan's own Edit Task dialog, which a task with no
                    plan behind it has no way into. */}
                Nothing is written down for this one yet.
                {task.planId ? (
                  <>
                    {" "}
                    <Link
                      href={`/whitbyos/work-plans/${task.planId}/tasks/${task.id}?edit=1`}
                      style={{ color: "var(--accent)" }}
                    >
                      Add the steps in the plan
                    </Link>{" "}
                    and they can be ticked off here.
                  </>
                ) : null}
              </p>
            ) : (
              task.steps.map((step, index) => (
                <div
                  key={`${step.text}-${index}`}
                  className="flex items-start gap-3 border-b border-line px-4 py-2.5 last:border-b-0"
                >
                  <form action={toggleTaskStep} className="flex items-center pt-px">
                    <input type="hidden" name="task_id" value={task.id} />
                    <input type="hidden" name="index" value={index} />
                    <SubmitPlain
                      aria-label={step.done ? `Mark step ${index + 1} not done` : `Mark step ${index + 1} done`}
                      className="flex h-[18px] w-[18px] items-center justify-center rounded-[5px] border-[1.5px] text-[11px]"
                      style={
                        step.done
                          ? {
                              background: "var(--success-solid)",
                              borderColor: "var(--success-solid)",
                              color: "#fff",
                            }
                          : { borderColor: "var(--border-strong)" }
                      }
                    >
                      {step.done ? "✓" : ""}
                    </SubmitPlain>
                  </form>

                  <span className="min-w-0 flex-1">
                    <span
                      className="block text-[13.5px] leading-[1.5]"
                      style={{
                        color: step.done ? "var(--text-tertiary)" : "var(--ink)",
                        textDecoration: step.done ? "line-through" : undefined,
                      }}
                    >
                      {step.text}
                    </span>
                    {shared && step.ownerName ? (
                      <span className="text-[12px]" style={{ color: "var(--text-tertiary)" }}>
                        {step.ownerName}
                      </span>
                    ) : null}
                  </span>
                </div>
              ))
            )}
          </Section>

          {task.requiredInputs.length > 0 ? (
            <Section title="Needed before this can start">
              {task.requiredInputs.map((input, index) => {
                const state = requirementState(input, needState);
                const slug = needSlug(input.label ?? "");
                const onForm = Boolean(ask?.fieldIds.has(needFieldId(slug)));
                const answered = Boolean(needState?.answered.has(slug));

                // Only what the client can give, and only where there is a
                // plan to ask from: the ask is a form on the plan, not on the
                // task.
                const askable =
                  input.from === "client" && Boolean(task.planId) && slug.length > 0;

                return (
                  <div
                    key={index}
                    className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-2.5 text-[13px] last:border-b-0"
                  >
                    <Pill tone="neutral">
                      {REQUIREMENT_LABEL[input.kind] ?? input.kind}
                    </Pill>
                    <span className="min-w-0 flex-1" style={{ color: "var(--ink)" }}>
                      {input.label}
                      {/* What it is for, where the plan said. A list of nouns
                          is a list somebody has to ask about. */}
                      {input.why ? (
                        <span className="block text-[12px]" style={{ color: "var(--text-tertiary)" }}>
                          {input.why}
                        </span>
                      ) : null}
                    </span>
                    {state ? (
                      <span
                        className="shrink-0"
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
                    ) : null}

                    {/*
                     * The same ask the plan's panel sends, from where the need
                     * is being read. Once it is on the client's form there is
                     * nothing left to press: asking again for something they
                     * are already looking at does nothing and says it did.
                     */}
                    {askable && !answered ? (
                      <form className="flex shrink-0 items-center gap-1">
                        <input type="hidden" name="plan_id" value={task.planId!} />
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
                            {/* The same gate as the plan's panel, on the one
                                row somebody happens to be looking at. */}
                            Approve and send
                          </SubmitPlain>
                        )}

                        {/* And the same bin. Whitby works these out from the
                            plan, so some are wrong, and without this the only
                            answer to a wrong row is to send it anyway. */}
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

          {/* A gap in the firm's own directory, said out loud. Whitby matches
              a task to a Provider where one fits; where none does, this is
              what it could not find, so somebody can go and find one. */}
          {task.providerNeed ? (
            <Section title="Needs an outside firm">
              <div className="px-4 py-3">
                <p className="text-[13.5px]" style={{ color: "var(--ink)", margin: 0 }}>
                  {task.providerNeed.category}
                </p>
                {task.providerNeed.why ? (
                  <p
                    className="mt-1 text-[13px] leading-[1.55]"
                    style={{ color: "var(--text-secondary)", margin: "4px 0 0" }}
                  >
                    {task.providerNeed.why}
                  </p>
                ) : null}
              </div>

              {/*
               * Firms a search actually named, where the directory has nobody.
               *
               * "Find a document attestation agent in Lagos" is a category, not
               * a lead: it leaves somebody doing the searching that has already
               * been done. These are candidates, not providers — nobody here
               * has screened them, which is the difference and is said out
               * loud.
               */}
              {(task.providerNeed.suggestions ?? []).length > 0 ? (
                <div className="border-t" style={{ borderColor: "var(--border)" }}>
                  <p
                    className="px-4 pt-2.5 text-[11.5px]"
                    style={{ color: "var(--text-tertiary)", margin: 0 }}
                  >
                    Found on the web, not screened by you
                  </p>

                  {(task.providerNeed.suggestions ?? []).map((one) => (
                    <div key={one.name} className="px-4 py-2.5">
                      <div className="text-[13px] font-medium">{one.name}</div>
                      {one.note ? (
                        <div
                          className="text-[12.5px] leading-[1.5]"
                          style={{ color: "var(--text-secondary)" }}
                        >
                          {one.note}
                        </div>
                      ) : null}
                      {one.url ? (
                        <a
                          href={one.url}
                          target="_blank"
                          rel="noreferrer"
                          className="block truncate text-[12.5px] no-underline"
                          style={{ color: "var(--accent)" }}
                        >
                          {one.url}
                        </a>
                      ) : null}
                      {one.phone ? (
                        <div className="text-[12.5px]" style={{ color: "var(--text-secondary)" }}>
                          {one.phone}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : null}

              <div className="border-t px-4 py-2.5" style={{ borderColor: "var(--border)" }}>
                <Link
                  href="/whitbyos/providers?new=1"
                  className="text-[12.5px] no-underline"
                  style={{ color: "var(--accent)" }}
                >
                  {(task.providerNeed.suggestions ?? []).length > 0
                    ? "Add one of these to your Providers"
                    : "Add a provider"}
                </Link>
              </div>
            </Section>
          ) : null}

          {task.expected_output ? (
            <Section title="What this produces">
              <p className="px-4 py-3 text-[13.5px] leading-[1.55]" style={{ margin: 0 }}>
                {task.expected_output}
              </p>
            </Section>
          ) : null}

          {task.rationale ? (
            <Section title="Why this is here">
              <p className="px-4 py-3 text-[13.5px] leading-[1.55]" style={{ margin: 0 }}>
                {task.rationale}
              </p>
            </Section>
          ) : null}

          {task.next_action || task.completion_evidence ? (
            <Section title="Notes">
              {task.next_action ? (
                <Line label="Next action">{task.next_action}</Line>
              ) : null}
              {task.completion_evidence ? (
                <Line label="Completion evidence">{task.completion_evidence}</Line>
              ) : null}
            </Section>
          ) : null}

          {/* Said only where it is true. This claimed the task was made by
              hand over one sitting inside a Work Stream, which it could see. */}
          {briefed ? null : (
            <p className="text-[13px]" style={{ color: "var(--text-tertiary)" }}>
              {task.workstreamId
                ? "Nothing was written down about how to do this one. It was drafted before Whitby wrote steps, or its steps were never saved."
                : "This task belongs to no Work Plan, so there is nothing written down about how to do it. Everything on it is on this page."}
            </p>
          )}
        </div>

        <aside className="flex w-full shrink-0 flex-col gap-4 lg:w-[300px]">
          <Section title={shared ? `${people.length} people on this task` : "Who is on it"}>
            {people.length === 0 ? (
              <p className="px-4 py-3 text-[13px]" style={{ color: "var(--text-faint)", margin: 0 }}>
                Nobody yet.
              </p>
            ) : (
              people.map((person) => {
                /*
                 * Each person's own name and face.
                 *
                 * This read `task.ownerName`, which is every assignee joined
                 * into one string: a single row showed "Sabahat Qadeer, Hazel
                 * Summers" beside a blank avatar, because a joined string has
                 * no initials and no photo. The task's own assignees are the
                 * first source; a step's owner covers anybody who holds a step
                 * without being assigned the task.
                 */
                const from = task.steps.find((step) => step.ownerUserId === person.userId);
                const known = task.people.find((one) => one.userId === person.userId);
                const name = known?.name ?? from?.ownerName ?? "Unnamed";

                return (
                  <div
                    key={person.userId}
                    className="flex items-center gap-2.5 border-b border-line px-4 py-2.5 last:border-b-0"
                  >
                    <OwnerAvatar
                      userId={person.userId}
                      name={name}
                      initials={known?.initials ?? from?.ownerInitials ?? "··"}
                      hasPhoto={known?.hasPhoto ?? from?.ownerHasPhoto ?? false}
                      size={22}
                    />
                    <span className="min-w-0 flex-1 truncate text-[13px]">{name}</span>
                    {shared && person.steps.length > 0 ? (
                      <span
                        className="shrink-0 text-[12px]"
                        style={{ color: "var(--text-tertiary)" }}
                      >
                        {stepsLabel(person.steps)}
                      </span>
                    ) : person.leads ? (
                      <span
                        className="shrink-0 text-[12px]"
                        style={{ color: "var(--text-tertiary)" }}
                      >
                        leads
                      </span>
                    ) : null}
                  </div>
                );
              })
            )}
          </Section>

          {task.externalLinks.length > 0 ? (
            <Section title="Where to go">
              {task.externalLinks.map((link, index) => (
                <div key={index} className="border-b border-line px-4 py-2.5 last:border-b-0">
                  <div className="text-[13px] font-medium">{link.label}</div>
                  {link.url ? (
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noreferrer"
                      className="block truncate text-[12.5px] no-underline"
                      style={{ color: "var(--accent)" }}
                    >
                      {link.url}
                    </a>
                  ) : null}
                  {[link.phone, link.email, link.address].filter(Boolean).map((line) => (
                    <div key={line} className="text-[12.5px]" style={{ color: "var(--text-secondary)" }}>
                      {line}
                    </div>
                  ))}
                  {/* Nothing looked this up, and a screen that says an address
                      was checked when it was not is worse than one that says
                      nothing. */}
                  {link.verified === false && (link.url || link.phone || link.address) ? (
                    <div className="mt-0.5 text-[11.5px]" style={{ color: "var(--warning-fg)" }}>
                      Check before use
                    </div>
                  ) : null}
                </div>
              ))}
            </Section>
          ) : null}

          <Section title="Filed under">
            {task.request_id ? (
              <Line label="Request">
                <Link
                  href={`/whitbyos/requests/${task.request_id}`}
                  className="no-underline"
                  style={{ color: "var(--accent)" }}
                >
                  {task.request_title ?? "Open the request"}
                </Link>
              </Line>
            ) : null}

            {task.planId ? (
              <Line label="Work Plan">
                <Link
                  href={`/whitbyos/work-plans/${task.planId}/tasks/${task.id}`}
                  className="no-underline"
                  style={{ color: "var(--accent)" }}
                >
                  Open it in the plan
                </Link>
              </Line>
            ) : task.workstreamId ? (
              <Line label="Work Plan">That plan has been deleted.</Line>
            ) : null}

            {/* Only where there is one. "Dependency: None" is a heading over
                an absence, printed on every task in the product. */}
            {task.dependency ? (
              <Line label="Waiting on">{task.dependency}</Line>
            ) : null}
          </Section>
        </aside>
      </div>

      {editing || reassign ? (
        <TaskDetailDialog
          task={task}
          assignees={assignees}
          reassigning={reassign}
          closeHref={here}
        />
      ) : null}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[10px] border" style={{ borderColor: "var(--border)" }}>
      <h2
        className="border-b px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.06em]"
        style={{ borderColor: "var(--border)", color: "var(--text-tertiary)", margin: 0 }}
      >
        {title}
      </h2>
      {children}
    </section>
  );
}

function Line({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-line px-4 py-2.5 last:border-b-0">
      <div className="text-[11.5px]" style={{ color: "var(--text-tertiary)" }}>
        {label}
      </div>
      <div className="text-[13px]" style={{ color: "var(--ink)" }}>
        {children}
      </div>
    </div>
  );
}

