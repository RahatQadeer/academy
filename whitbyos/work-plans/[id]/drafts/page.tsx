import Link from "next/link";
import { notFound } from "next/navigation";
import { BackLink } from "@/whitbyos/components/BackLink";
import { getWorkPlan } from "@/whitbyos/lib/work-plans";
import { shortDate } from "@/whitbyos/lib/format";

/**
 * Everything Whitby has drafted on this plan, on a screen of its own.
 *
 * The rail card used to carry the list: three summaries, a fold, and a
 * paragraph under it. On a plan with five drafts that is most of the rail,
 * which is the same mistake the client's list made before it was given a
 * screen. The card says how many and leads here; this is where they are read.
 *
 * Each row is a summary and a link to the task it was written on, because the
 * draft itself belongs with the work rather than in a list of drafts.
 */
export default async function PlanDraftsPage({ planId }: { planId: string }) {
  const plan = await getWorkPlan(planId);
  if (!plan) notFound();

  const basePath = `/whitbyos/work-plans/${plan.id}`;

  const rows = plan.workstreams.flatMap((stream) =>
    stream.tasks
      .filter((task) => task.whitbyDraft)
      .map((task) => ({
        taskId: task.id,
        title: task.title,
        stream: stream.name,
        summary: task.whitbyDraft!.summary,
        openPoints: task.whitbyDraft!.openPoints.length,
        at: task.whitbyDraftAt,
      })),
  );

  return (
    <div className="px-5 py-6 sm:px-8 sm:py-9 xl:px-12">
      <BackLink href={basePath} label={`Back to ${plan.name}`} />

      <div className="mx-auto w-full max-w-[760px]">
        <div className="mb-5">
          <h1 className="text-[24px] font-bold leading-tight tracking-[-0.3px]">
            What Whitby did
          </h1>
          <p className="mt-1.5 text-[13.5px]" style={{ color: "var(--text-tertiary)" }}>
            {plan.name}
          </p>
        </div>

        {rows.length === 0 ? (
          <div
            className="rounded-card border px-4 py-8 text-center"
            style={{ borderColor: "var(--chrome-line)", background: "var(--surface)" }}
          >
            <p className="text-[14px]" style={{ margin: 0 }}>
              Nothing drafted yet.
            </p>
            <p
              className="mt-1.5 text-[13px] leading-[1.55]"
              style={{ margin: "6px 0 0", color: "var(--text-tertiary)" }}
            >
              Whitby writes a first pass for the tasks it can start by itself. Use Make a
              start on the plan.
            </p>
          </div>
        ) : (
          <section
            className="overflow-hidden rounded-card border"
            style={{ borderColor: "var(--chrome-line)", background: "var(--surface)" }}
          >
            {rows.map((row) => (
              <Link
                key={row.taskId}
                href={`${basePath}/tasks/${row.taskId}`}
                className="group block border-b px-4 py-4 no-underline last:border-b-0 transition-colors hover:bg-[var(--surface-soft)]"
                style={{ borderColor: "var(--border)", color: "var(--ink)" }}
              >
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="text-[14px] font-medium leading-snug group-hover:underline">
                    {row.title}
                  </span>
                  <span className="text-[12px]" style={{ color: "var(--text-faint)" }}>
                    {row.stream}
                  </span>
                </div>

                <p
                  className="mt-1 text-[13px] leading-[1.55]"
                  style={{ margin: "4px 0 0", color: "var(--text-secondary)" }}
                >
                  {row.summary}
                </p>

                <div
                  className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px]"
                  style={{ color: "var(--text-tertiary)" }}
                >
                  {/* What is still missing, counted. It is the reason the task
                      is not finished, and the one thing on this screen worth
                      knowing before opening anything. */}
                  {row.openPoints > 0 ? (
                    <span style={{ color: "var(--warning-fg)" }}>
                      {row.openPoints === 1
                        ? "1 thing Whitby could not settle"
                        : `${row.openPoints} things Whitby could not settle`}
                    </span>
                  ) : (
                    <span>Nothing left open</span>
                  )}
                  {row.at ? <span>Drafted {shortDate(row.at)}</span> : null}
                </div>
              </Link>
            ))}
          </section>
        )}

        <p
          className="mt-4 text-[12.5px] leading-[1.5]"
          style={{ color: "var(--text-faint)" }}
        >
          First passes for the firm, on tasks Whitby could start by itself. Nothing here has
          been sent anywhere, and every task is still open.
        </p>
      </div>
    </div>
  );
}
