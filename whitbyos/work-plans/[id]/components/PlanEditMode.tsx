import { SubmitPlain } from "@/base/components/Submit";
import Link from "next/link";
import { StatusPill } from "@/whitbyos/components/StatusPill";
import { removeTask, removeWorkstream } from "@/whitbyos/work-plans/actions";
import type { WorkPlanDetail } from "@/whitbyos/lib/work-plans";
import { shortDate } from "@/whitbyos/lib/format";

/**
 * WP.17z — the plan with its parts laid open.
 *
 * The reference strips the screen back to what is being edited: no vital
 * signs, no progress, no view switch, no header buttons. Every Work Stream is
 * open, every task shows its own Edit and its own ✕, and the only way out is
 * Done.
 *
 * Removal posts straight from here rather than through a confirmation. That is
 * the reference's choice and it is a defensible one in this mode — you came
 * here to take things apart, and both a stream and a task are recreatable in a
 * click from the same screen.
 */
export function PlanEditMode({
  plan,
  basePath,
}: {
  plan: WorkPlanDetail;
  basePath: string;
}) {
  return (
    <div className="flex flex-col gap-6 lg:flex-row">
      <div className="flex min-w-0 flex-1 flex-col gap-3.5">
        <div className="flex items-center justify-between gap-4">
          <span className="text-[14px] font-semibold">
            Work Streams ({plan.workstreams.length}){" "}
            <span className="text-[12.5px] font-normal" style={{ color: "var(--text-tertiary)" }}>
             , editing
            </span>
          </span>

          <div className="flex shrink-0 gap-2">
            <Link
              href={`${basePath}?editing=1&stream=new`}
              scroll={false}
              className="rounded-control border border-line-strong bg-surface px-3 py-1.5 text-[12.5px] font-medium no-underline"
              style={{ color: "var(--ink)" }}
            >
              + Add Work Stream
            </Link>
            <Link
              href={basePath}
              className="rounded-control px-3 py-1.5 text-[12.5px] font-medium text-white no-underline hover:text-white"
              style={{ background: "var(--accent)" }}
            >
              Done
            </Link>
          </div>
        </div>

        {plan.workstreams.length === 0 ? (
          <div
            className="rounded-card border-2 border-dashed p-8 text-center text-[13px]"
            style={{ borderColor: "var(--border-strong)", color: "var(--text-tertiary)" }}
          >
            Nothing to edit yet, add the first Work Stream.
          </div>
        ) : (
          plan.workstreams.map((stream, index) => (
            <div key={stream.id} className="overflow-hidden rounded-[10px] border border-line">
              <div
                className="flex items-center gap-2.5 px-4 py-3.5"
                style={{ background: "var(--surface-soft)" }}
              >
                <span className="text-[11px]" style={{ color: "var(--text-disabled)" }}>
                  ▾
                </span>

                <span
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-control text-[11.5px] font-bold"
                  style={{ background: "var(--accent-tint)", color: "var(--accent)" }}
                >
                  {index + 1}
                </span>

                <Link
                  href={`${basePath}?editing=1&stream=${stream.id}`}
                  scroll={false}
                  className="min-w-0 flex-1 truncate text-[14.5px] font-semibold no-underline"
                  style={{ color: "var(--ink)" }}
                  title="Rename, reassign or describe this Work Stream"
                >
                  {stream.name}
                </Link>

                <StatusPill status={stream.status} />

                <form action={removeWorkstream}>
                  <input type="hidden" name="plan_id" value={plan.id} />
                  <input type="hidden" name="workstream_id" value={stream.id} />
                  <SubmitPlain
                   
                    title="Remove Work Stream"
                    aria-label={`Remove ${stream.name}`}
                    className="px-0.5 text-[17px] font-bold leading-none"
                    style={{ color: "var(--danger-text)" }}
                  >
                    ✕
                  </SubmitPlain>
                </form>
              </div>

              {stream.tasks.length > 0 ? (
                <div
                  className="flex flex-col gap-0.5 border-t py-1 pl-[50px] pr-4 pb-3"
                  style={{ borderColor: "var(--canvas)" }}
                >
                  {stream.tasks.map((task) => (
                    <div key={task.id} className="flex items-center gap-2.5 p-2">
                      <span className="min-w-0 flex-1 truncate text-[13.5px]">{task.title}</span>

                      <span
                        className="w-[52px] shrink-0 text-[12px]"
                        style={{ color: "var(--text-disabled)" }}
                      >
                        {task.due_date ? shortDate(task.due_date) : ""}
                      </span>

                      <Link
                        href={`${basePath}?editing=1&task=${task.id}`}
                        scroll={false}
                        className="shrink-0 rounded-control border px-2.5 py-1 text-[12px] font-medium no-underline"
                        style={{ borderColor: "var(--accent)", color: "var(--accent)" }}
                      >
                        Edit
                      </Link>

                      <form action={removeTask}>
                        <input type="hidden" name="plan_id" value={plan.id} />
                        <input type="hidden" name="task_id" value={task.id} />
                        <SubmitPlain
                         
                          title="Remove task"
                          aria-label={`Remove ${task.title}`}
                          className="px-0.5 text-[15px] font-bold leading-none"
                          style={{ color: "var(--danger-text)" }}
                        >
                          ✕
                        </SubmitPlain>
                      </form>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          ))
        )}
      </div>

      <aside className="flex w-full shrink-0 flex-col gap-4 lg:w-[280px]">
        <div className="rounded-[8px] border border-line p-4">
          <div className="mb-2.5 text-[13px] font-semibold">Editing Work Streams</div>
          <p className="text-[12.5px] leading-[1.7]" style={{ color: "var(--text-secondary)" }}>
            Click a Work Stream name to rename it, reassign its owner, or remove
            it. Each task row has its own <strong>Edit</strong> button and a ✕ to
            remove that task. Click &ldquo;Done&rdquo; to return to the normal
            view.
          </p>
        </div>
      </aside>
    </div>
  );
}
