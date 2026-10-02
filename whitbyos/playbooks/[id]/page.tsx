import { SubmitPlain } from "@/base/components/Submit";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/base/components/Button";
import { Callout } from "@/base/components/Callout";
import { Pill } from "@/base/components/Pill";
import { Toast } from "@/whitbyos/components/Toast";
import { EditPlaybookDialog } from "@/whitbyos/playbooks/components/PlaybookDialogs";
import { duplicatePlaybook } from "@/whitbyos/playbooks/actions";
import {
  getPlaybook,
  listPlaybookTurns,
  listPlaybookUsage,
  listPlaybookVersions,
} from "@/whitbyos/lib/playbooks";
import { WhitbyStreamComposer } from "@/whitbyos/playbooks/components/WhitbyStreamComposer";
import { refinePlaybook } from "@/whitbyos/playbooks/actions";
import { sharedAudience, sharedLabel, sharedTone, streamSummary } from "@/whitbyos/lib/playbook-vocab";
import { streamInk, streamTint } from "@/whitbyos/lib/plan-ink";
import { relativeTime } from "@/whitbyos/lib/format";

const LIST = "/whitbyos/playbooks";

/**
 * Screen 6.1 — one Playbook.
 *
 * A record rather than a workspace: §6.10 is explicit that editing a live
 * Request built from a Playbook never changes the Playbook, and the reverse
 * holds too. The description says so, because otherwise the Work Streams below
 * look editable in place and are not.
 */
export default async function PlaybookDetailPage({
  playbookId,
  searchParams,
}: {
  playbookId: string;
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const playbook = await getPlaybook(playbookId);
  if (!playbook) notFound();

  const [versions, usage, turns] = await Promise.all([
    listPlaybookVersions(playbookId),
    listPlaybookUsage(playbookId),
    listPlaybookTurns(playbookId),
  ]);

  const one = (value: string | string[] | undefined) =>
    Array.isArray(value) ? value[0] : value;

  const here = `${LIST}/${playbookId}`;
  const editing = one(searchParams?.edit) === "1";
  const error = one(searchParams?.error);
  const saved = one(searchParams?.saved) === "1";
  const created = one(searchParams?.created) === "1";
  const duplicated = one(searchParams?.duplicated) === "1";

  return (
    <div className="px-5 py-6 sm:px-8 sm:py-9 xl:px-12" data-pa-playbook-page>
      <div className="mb-2.5 text-[12.5px]" style={{ color: "var(--text-faint)" }}>
        <Link href={LIST} className="no-underline" style={{ color: "inherit" }}>
          Playbooks
        </Link>
        {" / "}
        <span style={{ color: "var(--text-secondary)" }}>{playbook.name}</span>
      </div>

      <div className="mb-7 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="truncate text-[22px] font-bold leading-[1.2]">
              {playbook.name}
            </h1>
            <Pill tone={sharedTone(playbook.sharedLevel)}>
              {sharedLabel(playbook.sharedLevel)}
            </Pill>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px]" style={{ color: "var(--text-tertiary)" }}>
            {playbook.category ? (
              <span
                className="rounded-full px-2 py-0.5 text-[11.5px] font-medium"
                style={{ background: "var(--surface-soft)", color: "var(--text-secondary)" }}
              >
                {playbook.category}
              </span>
            ) : null}
            <span>v{playbook.version}</span>
            <span aria-hidden>·</span>
            <span>Updated {relativeTime(playbook.updatedAt)}</span>
            <span aria-hidden>·</span>
            <span>
              Used on {playbook.timesUsed} Work Plan{playbook.timesUsed === 1 ? "" : "s"}
            </span>
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
          <form action={duplicatePlaybook}>
            <input type="hidden" name="playbook_id" value={playbookId} />
            <SubmitPlain
              className="rounded-control border border-line-strong px-3.5 py-[7px] text-[13px] font-medium"
              style={{ background: "var(--surface)", color: "var(--ink)" }}
            >
              Duplicate
            </SubmitPlain>
          </form>

          <Button unsized href={`${here}?edit=1`} variant="secondary" className="px-3.5 py-[7px] text-[13px]">
            Edit
          </Button>

          <WhitbyStreamComposer
            variant="popover"
            draftId={playbookId}
            turns={turns}
            action={refinePlaybook}
            playbookName={playbook.name}
            initiallyOpen={saved || Boolean(error)}
            prompt="Ask anything about this Playbook"
            suggestions={[
              "Update a Work Stream",
              "Reorder these Work Streams",
              "Merge streams that overlap",
              "Draft the next version",
            ]}
          />

          <Button unsized
            href={`/whitbyos/requests?new=1&playbook=${playbookId}`}
            variant="primary"
            className="px-3.5 py-[7px] text-[13px]"
          >
            Use for New Request →
          </Button>
        </div>
      </div>

      {error ? (
        <div className="mb-5">
          <Callout tone="danger">{error}</Callout>
        </div>
      ) : null}

      {/* 6.1 sets the description in a bordered panel rather than loose on
          the page, it is a statement about the Playbook, and the box is what
          separates it from the Work Streams under it. */}
      {playbook.description ? (
        <div className="mb-6">
          <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.06em]" style={{ color: "var(--text-tertiary)" }}>
            Description
          </h2>
          <div
            className="rounded-[12px] border px-4 py-3.5 text-[13.5px] leading-[1.7]"
            style={{
              borderColor: "var(--border)",
              background: "var(--surface-soft)",
              color: "var(--text-secondary)",
            }}
          >
            {playbook.description}
          </div>
        </div>
      ) : null}

      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-[14px] font-semibold">
          Work Streams
          <span className="ml-1.5 font-medium" style={{ color: "var(--text-tertiary)" }}>
            ({playbook.streams.length})
          </span>
        </h2>
        <Link
          href={`${here}?edit=1`}
          className="rounded-control px-2 py-1 text-[12.5px] font-medium no-underline"
          style={{ color: "var(--accent)" }}
        >
          + Add Work Stream
        </Link>
      </div>

      <div className="flex flex-col gap-6 lg:flex-row">
        <div className="flex min-w-0 flex-1 flex-col gap-5">
      {playbook.streams.length === 0 ? (
        <div
          className="rounded-card border-2 border-dashed px-4 py-10 text-center text-[13px]"
          style={{ borderColor: "var(--border-strong)", color: "var(--text-tertiary)" }}
        >
          No Work Streams in this Playbook yet. Edit it to lay out how this kind
          of engagement runs.
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {playbook.streams.map((stream, index) => (
            <details
              key={`${stream.name}-${index}`}
              open={index === 0}
              className="pa-playbook-stream overflow-hidden rounded-card border border-line"
            >
              <summary className="flex cursor-pointer items-center gap-2.5 px-4 py-3.5">
                <span
                  className="pa-playbook-chevron shrink-0 text-[11px]"
                  style={{ color: "var(--text-quiet)" }}
                  aria-hidden
                >
                  ▾
                </span>
                <span
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[6px] text-[11.5px] font-bold"
                  style={{ background: streamTint(index), color: streamInk(index) }}
                >
                  {index + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14.5px] font-semibold">
                    {stream.name}
                  </span>
                  <span
                    className="mt-0.5 block text-[12.5px]"
                    style={{ color: "var(--text-tertiary)" }}
                  >
                    {stream.purpose || streamSummary(stream)}
                  </span>
                </span>
                {stream.purpose ? (
                  <span
                    className="hidden shrink-0 text-[12px] sm:inline"
                    style={{ color: "var(--text-quiet)" }}
                  >
                    {streamSummary(stream)}
                  </span>
                ) : null}
              </summary>

              {stream.tasks.length > 0 ? (
                <div className="flex flex-col border-t border-line py-1.5 pl-[52px] pr-4">
                  {stream.tasks.map((task, taskIndex) => (
                    <div key={`${task.title}-${taskIndex}`} className="py-1.5">
                      <div className="flex items-start gap-2 text-[13.5px] leading-[1.45]">
                        <span
                          className="mt-[6px] h-[5px] w-[5px] shrink-0 rounded-full"
                          style={{ background: streamInk(index) }}
                          aria-hidden
                        />
                        <span>{task.title}</span>
                      </div>
                      {task.checklist?.length ? (
                        <div className="mt-1 pl-[13px]">
                          {task.checklist.map((item) => (
                            <div
                              key={item}
                              className="flex items-start gap-2 py-0.5 text-[12.5px] leading-[1.45]"
                              style={{ color: "var(--text-secondary)" }}
                            >
                              <span
                                className="mt-[6px] h-[4px] w-[4px] shrink-0 rounded-[1px] border"
                                style={{ borderColor: "var(--border-strong)" }}
                                aria-hidden
                              />
                              {item}
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : (
                <div
                  className="border-t border-line px-4 py-3 pl-[52px] text-[13px]"
                  style={{ color: "var(--text-tertiary)" }}
                >
                  No tasks laid out for this stream yet.
                </div>
              )}
            </details>
          ))}
        </div>
      )}
        </div>

        {/* 6.1's rail. Four panels, and each one only says what there is to
            say: a Playbook nobody has used yet says so rather than showing an
            empty list under a heading that promises one. */}
        <aside className="flex w-full shrink-0 flex-col gap-4 lg:w-[300px]">
          <Panel title="Version History">
            {versions.length === 0 ? (
              <Quiet>Nothing recorded before now.</Quiet>
            ) : (
              versions.map((entry) => (
                <div key={entry.version} className="flex gap-2.5 text-[12.5px] leading-[1.45]">
                  <span
                    className="mt-[5px] h-[6px] w-[6px] shrink-0 rounded-full"
                    style={{ background: "var(--accent)" }}
                    aria-hidden
                  />
                  <span>
                    <strong style={{ color: "var(--ink)" }}>v{entry.version}</strong>
                    {entry.reason ? ` · ${entry.reason}` : null}
                    {entry.by ? (
                      <span style={{ color: "var(--text-tertiary)" }}> · {entry.by}</span>
                    ) : null}
                    <span className="block text-[11.5px]" style={{ color: "var(--text-faint)" }}>
                      {relativeTime(entry.at)}
                    </span>
                  </span>
                </div>
              ))
            )}
          </Panel>

          <Panel title="Used On">
            {usage.length === 0 ? (
              <Quiet>Not used on a Work Plan yet.</Quiet>
            ) : (
              usage.map((plan) => (
                <Link
                  key={plan.id}
                  href={`/whitbyos/work-plans/${plan.id}`}
                  className="text-[12.5px] no-underline"
                  style={{ color: "var(--ink)" }}
                >
                  <span className="block font-medium">{plan.name}</span>
                  <span style={{ color: "var(--text-faint)" }}>{planStatus(plan.status)}</span>
                </Link>
              ))
            )}
          </Panel>

          <Panel title="Sharing">
            <Quiet>Visible to: {sharedAudience(playbook.sharedLevel)}</Quiet>
            <Quiet>Owner: {playbook.ownerName ?? "not recorded"}</Quiet>
          </Panel>
        </aside>
      </div>

      {editing ? (
        <EditPlaybookDialog
          playbookId={playbookId}
          closeHref={here}
          error={error}
          values={{
            name: playbook.name,
            category: playbook.category,
            description: playbook.description,
            sharedLevel: playbook.sharedLevel,
            streamNames: playbook.streams.map((stream) => stream.name),
          }}
        />
      ) : null}

      {created ? (
        <Toast
          title="Playbook created"
          detail={`${playbook.name} is ready to use on a Request.`}
          closeHref={here}
        />
      ) : null}

      {duplicated ? (
        <Toast
          title="Playbook duplicated"
          detail="The copy starts private, share it when you are happy with it."
          closeHref={here}
        />
      ) : null}

      {saved ? (
        <Toast
          title="Playbook saved"
          detail={`Now at v${playbook.version}.`}
          closeHref={here}
        />
      ) : null}
    </div>
  );
}

const PLAN_STATUS: Record<string, string> = {
  draft: "Draft",
  active: "Running",
  complete: "Completed",
};

function planStatus(value: string) {
  return PLAN_STATUS[value] ?? value;
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      className="flex flex-col gap-2.5 rounded-[12px] border p-3.5"
      style={{ borderColor: "var(--border)", background: "var(--surface)" }}
    >
      <span className="text-[11px] font-semibold uppercase tracking-[0.05em]" style={{ color: "var(--text-tertiary)" }}>
        {title}
      </span>
      <div className="flex flex-col gap-2">{children}</div>
    </div>
  );
}

function Quiet({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[12.5px] leading-[1.5]" style={{ color: "var(--text-secondary)" }}>
      {children}
    </span>
  );
}
