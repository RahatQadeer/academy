import Link from "next/link";
import { Callout } from "@/base/components/Callout";
import { Button } from "@/base/components/Button";
import { Submit, SubmitPlain } from "@/base/components/Submit";
import { WizardChrome } from "@/whitbyos/components/WizardChrome";
import { getPlaybook, listPlaybookTurns } from "@/whitbyos/lib/playbooks";
import { sharedAudience, sharedLabel } from "@/whitbyos/lib/playbook-vocab";
import {
  addPlaybookStream,
  addPlaybookTask,
  askWhitbyForStreams,
  finishPlaybook,
  removePlaybookStream,
  removePlaybookTask,
  renamePlaybookStream,
} from "@/whitbyos/playbooks/actions";
import { WhitbyStreamComposer } from "@/whitbyos/playbooks/components/WhitbyStreamComposer";

const LIST = "/whitbyos/playbooks";
const NEW = `${LIST}/new`;

function one(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * 6.0c — Step 3, where the Playbook is actually built.
 *
 * Every Work Stream is open. The reference collapses all but the first and
 * says "+ 3 more Work Streams carried over — expand any above to review before
 * saving", which is a sensible thing to draw and a poor thing to build: this
 * is the one screen whose whole job is reviewing what carried over, and a
 * screen that hides most of it to save height is asking to be scrolled past.
 * The count is kept; the hiding is not.
 */
export default async function PlaybookStreamsPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const draftId = one(searchParams?.draft) ?? "";
  const error = one(searchParams?.error);
  const editing = one(searchParams?.edit);

  const [draft, turns] = await Promise.all([
    draftId ? getPlaybook(draftId) : Promise.resolve(null),
    draftId ? listPlaybookTurns(draftId) : Promise.resolve([]),
  ]);
  if (!draft) {
    return (
      <WizardChrome steps={STEPS} current={2} backHref={LIST} backLabel="Cancel">
        <div className="flex flex-1 items-center justify-center px-10 py-12">
          <Callout tone="danger">
            That Playbook draft is no longer here. <Link href={NEW}>Start again</Link>.
          </Callout>
        </div>
      </WizardChrome>
    );
  }

  const streams = draft.streams;
  const tasks = streams.reduce((total, stream) => total + stream.tasks.length, 0);
  const here = `${NEW}/streams?draft=${draftId}`;

  return (
    <WizardChrome
      steps={STEPS}
      current={2}
      backHref={`${NEW}/details?from=blank&draft=${draftId}`}
      backLabel="Back"
    >
      <div className="flex flex-1 flex-col px-5 py-6 sm:px-8 sm:py-9 xl:px-12">
        <div className="mb-[18px] flex items-start justify-between gap-4">
            <div>
              <h1 className="mb-1 text-[21px] font-bold">{draft.name}</h1>
              <p className="text-[12.5px]" style={{ color: "var(--text-tertiary)" }}>
                {draft.category ?? "Uncategorised"} · {sharedLabel(draft.sharedLevel)}
              </p>
            </div>

            <form action={finishPlaybook}>
              <input type="hidden" name="draft_id" value={draftId} />
              <Submit unsized variant="primary" className="px-4 py-[9px] text-[13.5px]">
                Save Playbook →
              </Submit>
            </form>
        </div>

        <div className="flex flex-col gap-7 lg:flex-row">
        <div className="flex min-w-0 max-w-[760px] flex-1 flex-col gap-3">
          {error ? <Callout tone="danger">{error}</Callout> : null}

          <div className="flex items-center justify-between gap-4">
            <span className="text-[14px] font-semibold">Work Streams ({streams.length})</span>
            {/* 6.0c puts Add Work Stream up here beside the count. The field
                it opens is at the foot of the list, which is where a new one
                is going to appear. */}
            <a
              href="#add-work-stream"
              className="rounded-control border border-line-strong px-3 py-1.5 text-[12.5px] font-medium no-underline"
              style={{ background: "var(--surface)", color: "var(--ink)" }}
            >
              + Add Work Stream
            </a>
          </div>

          {streams.length === 0 ? (
            <p className="py-6 text-[13px]" style={{ color: "var(--text-muted)" }}>
              No Work Streams yet. Add one below, or ask Whitby to draft them from the
              description.
            </p>
          ) : (
            <div className="flex flex-col gap-2.5">
              {streams.map((stream, index) => (
                <div key={`${stream.name}-${index}`} className="overflow-hidden rounded-card border border-line">
                  <div
                    className="flex items-center gap-2.5 px-4 py-3.5"
                    style={{ background: "var(--surface-soft)" }}
                  >
                    <span className="text-[11px]" style={{ color: "var(--text-quiet)" }} aria-hidden>
                      ▾
                    </span>
                    <span
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[6px] text-[11.5px] font-bold"
                      style={{ background: "var(--accent-tint)", color: "var(--accent)" }}
                    >
                      {index + 1}
                    </span>

                    {editing === String(index) ? (
                      <form action={renamePlaybookStream} className="flex flex-1 items-center gap-2">
                        <input type="hidden" name="draft_id" value={draftId} />
                        <input type="hidden" name="index" value={index} />
                        <input
                          name="name"
                          defaultValue={stream.name}
                          autoFocus
                          className="min-w-0 flex-1 rounded-control border border-line-strong px-2.5 py-1.5 text-[13.5px]"
                        />
                        <Submit unsized variant="primary" className="px-3 py-1.5 text-[12px]">
                          Save
                        </Submit>
                        <Link href={here} className="text-[12px] no-underline" style={{ color: "var(--text-muted)" }}>
                          Cancel
                        </Link>
                      </form>
                    ) : (
                      <>
                        <span className="min-w-0 flex-1 text-[14.5px] font-semibold">{stream.name}</span>
                        <span className="shrink-0 text-[12px]" style={{ color: "var(--text-muted)" }}>
                          {stream.tasks.length} task{stream.tasks.length === 1 ? "" : "s"}
                        </span>
                        <Link
                          href={`${here}&edit=${index}`}
                          className="shrink-0 rounded-[5px] border px-2 py-0.5 text-[11px] no-underline"
                          style={{ borderColor: "var(--accent)", color: "var(--accent)" }}
                        >
                          Edit
                        </Link>
                        <form action={removePlaybookStream}>
                          <input type="hidden" name="draft_id" value={draftId} />
                          <input type="hidden" name="index" value={index} />
                          <SubmitPlain
                           
                            title={`Remove ${stream.name}`}
                            aria-label={`Remove ${stream.name}`}
                            className="cursor-pointer px-1 text-[14px] font-bold"
                            style={{ color: "var(--danger-text)" }}
                          >
                            ✕
                          </SubmitPlain>
                        </form>
                      </>
                    )}
                  </div>

                  <div
                    className="flex flex-col gap-1.5 pb-3.5 pl-[50px] pr-4 pt-2"
                    style={{ borderTop: "1px solid var(--canvas)" }}
                  >
                    {stream.tasks.map((task, taskIndex) => (
                      <div key={`${task.title}-${taskIndex}`} className="flex items-center gap-2">
                        <span
                          className="h-[5px] w-[5px] shrink-0 rounded-full"
                          style={{ background: "var(--text-tertiary)" }}
                          aria-hidden
                        />
                        <span className="min-w-0 flex-1 text-[13px]">{task.title}</span>
                        <form action={removePlaybookTask}>
                          <input type="hidden" name="draft_id" value={draftId} />
                          <input type="hidden" name="index" value={index} />
                          <input type="hidden" name="task_index" value={taskIndex} />
                          <SubmitPlain
                           
                            title={`Remove ${task.title}`}
                            aria-label={`Remove ${task.title}`}
                            className="cursor-pointer px-1 text-[12px]"
                            style={{ color: "var(--text-tertiary)" }}
                          >
                            ✕
                          </SubmitPlain>
                        </form>
                      </div>
                    ))}

                    <form action={addPlaybookTask} className="flex items-center gap-2 pt-0.5">
                      <input type="hidden" name="draft_id" value={draftId} />
                      <input type="hidden" name="index" value={index} />
                      <input
                        name="title"
                        placeholder="+ Add task"
                        aria-label={`Add a task to ${stream.name}`}
                        className="min-w-0 flex-1 border-none bg-transparent text-[13px] outline-none"
                        style={{ color: "var(--accent)" }}
                      />
                    </form>
                  </div>
                </div>
              ))}
            </div>
          )}

          <form action={addPlaybookStream} id="add-work-stream" className="flex gap-2">
            <input type="hidden" name="draft_id" value={draftId} />
            <input
              name="name"
              placeholder="+ Add another Work Stream"
              aria-label="Add a Work Stream"
              className="min-w-0 flex-1 rounded-control border border-line-dashed bg-transparent px-3 py-2.5 text-[13px]"
            />
            <Submit unsized variant="secondary" className="px-3.5 py-2 text-[13px]">
              Add
            </Submit>
          </form>
        </div>

        <aside className="flex w-full shrink-0 flex-col gap-4 lg:w-[340px]">
          <div className="flex flex-col gap-2 rounded-card border border-line p-4">
            <span className="text-[13px] font-semibold">Playbook Details</span>
            <Line>Category: {draft.category ?? "None"}</Line>
            <Line>Visible to: {sharedAudience(draft.sharedLevel)}</Line>
            <Line>
              {tasks} task{tasks === 1 ? "" : "s"} across {streams.length} stream
              {streams.length === 1 ? "" : "s"}
            </Line>
            {draft.description ? (
              <p className="mt-1 text-[12.5px] leading-[1.55]" style={{ color: "var(--text-secondary)" }}>
                {draft.description}
              </p>
            ) : null}
          </div>

          <WhitbyStreamComposer
            draftId={draftId}
            turns={turns}
            action={askWhitbyForStreams}
            playbookName={draft.name}
            prompt={
              streams.length > 0
                ? "Want me to merge, reorder, or trim any of these Work Streams before you save?"
                : "Want help drafting Work Streams for this Playbook from a description?"
            }
          />

          <div
            className="rounded-card px-4 py-3 text-[12px] leading-[1.6]"
            style={{ background: "var(--surface-soft)", color: "var(--text-secondary)" }}
          >
            <strong style={{ color: "var(--ink)" }}>Tip</strong>
            <br />
            Work Streams saved here carry over as-is when this Playbook is used to
            start a new Work Plan.
          </div>
        </aside>
        </div>
      </div>
    </WizardChrome>
  );
}

const STEPS = ["Starting point", "Details", "Build Work Streams", "Save"];

function Line({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[12.5px]" style={{ color: "var(--text-secondary)" }}>
      {children}
    </span>
  );
}
