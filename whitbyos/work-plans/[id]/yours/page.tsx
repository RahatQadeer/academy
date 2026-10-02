import Link from "next/link";
import { notFound } from "next/navigation";
import { BackLink } from "@/whitbyos/components/BackLink";
import { getWorkPlan } from "@/whitbyos/lib/work-plans";
import { firmNeeds, type OwnItem } from "@/whitbyos/lib/plan-requirements";
import { shortDate } from "@/whitbyos/lib/format";

/**
 * What only the professional can do, on a screen of its own.
 *
 * The third of three lists, and the plan is finally honest about all three:
 * Whitby does what it can by itself, the client is asked for what only they
 * hold, and this is what is left. Decisions nobody else can make, and the
 * firm's own homework.
 *
 * Short by construction rather than by truncation. The brief asks for both
 * checklists to stay short, and `firmNeeds` keeps this one short by being
 * strict about what earns a place: everything else on a plan is ordinary
 * work with an owner and a date, and it is already on the plan.
 */
export default async function YourChecklistPage({ planId }: { planId: string }) {
  const plan = await getWorkPlan(planId);
  if (!plan) notFound();

  const items = firmNeeds(plan.workstreams);
  const basePath = `/whitbyos/work-plans/${plan.id}`;

  const decide = items.filter((row) => row.kind === "decide");
  const provide = items.filter((row) => row.kind === "provide");

  return (
    <div className="px-5 py-6 sm:px-8 sm:py-9 xl:px-12">
      <BackLink href={basePath} label={`Back to ${plan.name}`} />

      <div className="mx-auto w-full max-w-[760px]">
        <div className="mb-5">
          <h1 className="text-[24px] font-bold leading-tight tracking-[-0.3px]">
            Your Checklist
          </h1>
          <p className="mt-1.5 text-[13.5px]" style={{ color: "var(--text-tertiary)" }}>
            {plan.name}
          </p>
        </div>

        {items.length === 0 ? (
          <div
            className="rounded-card border px-4 py-8 text-center"
            style={{ borderColor: "var(--chrome-line)", background: "var(--surface)" }}
          >
            <p className="text-[14px]" style={{ margin: 0 }}>
              Nothing here needs you.
            </p>
            <p
              className="mt-1.5 text-[13px] leading-[1.55]"
              style={{ margin: "6px 0 0", color: "var(--text-tertiary)" }}
            >
              No decision is waiting and the firm has everything it has to supply. The rest
              of this plan is work with an owner and a date on it.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-5">
            {/* Decisions first. A decision blocks the work under it, and the
                firm's own paperwork rarely does. */}
            {decide.length > 0 ? (
              <Section
                title="Decisions only you can make"
                blurb="The work under each of these waits until you have answered."
                items={decide}
                basePath={basePath}
              />
            ) : null}

            {provide.length > 0 ? (
              <Section
                title="Things the firm has to supply"
                blurb="Nobody is going to send these in. They come from here."
                items={provide}
                basePath={basePath}
              />
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}

function Section({
  title,
  blurb,
  items,
  basePath,
}: {
  title: string;
  blurb: string;
  items: OwnItem[];
  basePath: string;
}) {
  return (
    <section
      className="overflow-hidden rounded-card border"
      style={{ borderColor: "var(--chrome-line)", background: "var(--surface)" }}
    >
      <header
        className="border-b px-4 py-3"
        style={{ borderColor: "var(--border)", background: "var(--surface-soft)" }}
      >
        <div className="text-[11.5px] font-semibold uppercase tracking-[0.08em]">{title}</div>
        <p
          className="mt-0.5 text-[12px] leading-[1.45]"
          style={{ margin: "2px 0 0", color: "var(--text-tertiary)" }}
        >
          {blurb}
        </p>
      </header>

      {items.map((row) => (
        /* Every row opens the task it came from. A checklist that cannot be
           acted on from itself is a list of things to go and find. */
        <Link
          key={row.key}
          href={`${basePath}/tasks/${row.taskId}`}
          className="group flex items-start justify-between gap-4 border-b px-4 py-3.5 no-underline last:border-b-0 transition-colors hover:bg-[var(--surface-soft)]"
          style={{ borderColor: "var(--border)", color: "var(--ink)" }}
        >
          <span className="min-w-0 flex-1">
            <span className="block text-[14px] font-medium leading-snug group-hover:underline">
              {row.label}
            </span>
            <span
              className="mt-1 block text-[12.5px] leading-[1.5]"
              style={{ color: "var(--text-tertiary)" }}
            >
              {/* The reason where the plan gave one, and otherwise the task
                  it belongs to. Never both: two lines of context on a list
                  meant to be read at a glance is the long list again. */}
              {row.why ?? `For ${row.taskTitle}`}
            </span>
          </span>

          {row.dueBy ? (
            <span
              className="shrink-0 rounded-full px-2.5 py-1 text-[11.5px] font-semibold tabular-nums"
              style={{ background: "var(--surface-active)", color: "var(--text-secondary)" }}
            >
              {shortDate(row.dueBy)}
            </span>
          ) : null}
        </Link>
      ))}
    </section>
  );
}
