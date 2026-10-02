import Link from "next/link";
import { Pill } from "@/base/components/Pill";
import { EmptyState } from "@/client-portal/components/States";
import { toWhitbyPlan } from "@/client-portal/lib/plan-view";
// The portal's own `shortDate`, not Whitby's: `target_date` is a `date` column
// — a day with no time and no zone — and this one reads it in UTC, where the
// day is the day. Whitby's reads it as midnight UTC and draws it in the
// reader's zone, which west of UTC turns "Sep 30" into "Sep 29".
import { shortDate } from "@/client-portal/lib/format";
import { relativeTime } from "@/whitbyos/lib/format";
import {
  PlanProgressBar,
  healthLabel,
  planStatusColour,
  planStatusLabel,
  urgencyLabel,
} from "@/whitbyos/work-plans/components/PlanMeters";
import { PLAN_VIEWS } from "@/whitbyos/work-plans/[id]/components/PlanViews";
import { PlanStreamList } from "@/client-portal/requests/plan/components/PlanStreamList";
import type { PortalPlan } from "@/client-portal/types";

/**
 * A Request's Work Plans tab — Whitby's 3.3w, as the client reads it.
 *
 * There was a Work Plans tab here before and it was a list of links: a plan's
 * name, a task count and an arrow. It was removed because on a real account it
 * was usually empty, and a permanent "No work plan shared yet" is worse than no
 * tab at all. What it is not, and what this is, is the plan itself.
 *
 * So the tab draws each shared plan the way WP.17 draws one — the meta line,
 * the progress meter, and the Work Streams open with their tasks under them —
 * out of the professional's own `PlanMeters` and the portal's read-only copy of
 * WP.17's List. A client and their attaché looking at one plan see one plan.
 *
 * The five other views (Table, Grid, Board, Timeline, Charts) are a link away
 * rather than inline, and for a mechanical reason: each of those components
 * builds its own links by appending `?view=`, `?group=`, `?scale=` to the
 * `basePath` it is handed, so they can only be driven from a screen whose whole
 * query string is theirs. That screen exists — `/requests/<id>/plans/<planId>`,
 * Whitby's components in `clientView` mode — and the row of view links here
 * opens it on whichever view was asked for.
 *
 * The empty state stays honest about what a client is actually waiting for: a
 * plan reaches them only when the professional ticks "Share this Work Plan with
 * the client" on WP.17v, and until then there is nothing shared to show.
 */
export function RequestPlansPanel({
  plans,
  requestId,
  requestTitle,
  canTick = false,
}: {
  plans: PortalPlan[];
  requestId: string;
  requestTitle: string;
  /** False for a view-only member; the tasks are then read, not ticked. */
  canTick?: boolean;
}) {
  if (plans.length === 0) {
    return (
      <EmptyState
        glyph="◈"
        title="No work plan shared yet"
        body="When your team shares the plan for this request, you'll see every part of the work, who is on it and how far along it is."
      />
    );
  }

  return (
    <div className="flex flex-col gap-7">
      {plans.map((plan) => (
        <PlanBlock
          key={plan.id}
          plan={plan}
          requestId={requestId}
          requestTitle={requestTitle}
          canTick={canTick}
        />
      ))}
    </div>
  );
}

/** One shared plan, laid out as WP.17 lays out the same plan. */
function PlanBlock({
  plan: shared,
  requestId,
  requestTitle,
  canTick,
}: {
  plan: PortalPlan;
  requestId: string;
  requestTitle: string;
  canTick: boolean;
}) {
  // The same conversion the plan screen makes, so the two draw one plan from
  // one shape: every field the portal was not sent is filled with nothing
  // rather than a guess.
  const plan = toWhitbyPlan(shared, requestTitle);
  const basePath = `/client-portal/requests/${requestId}/plans/${plan.id}`;

  return (
    <section>
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1.5">
        <h2 className="text-[17px] font-bold tracking-[-0.2px]">
          <Link href={basePath} className="no-underline" style={{ color: "var(--ink)" }}>
            {plan.name}
          </Link>
        </h2>
        <Link
          href={basePath}
          className="shrink-0 text-[12.5px] no-underline"
          style={{ color: "var(--accent)" }}
        >
          Open full Work Plan →
        </Link>
      </div>

      {plan.desired_outcome ? (
        <p
          className="mb-3 max-w-[640px] text-[13px] leading-[1.5]"
          style={{ color: "var(--text-secondary)" }}
        >
          {plan.desired_outcome}
        </p>
      ) : null}

      {/* WP.17's meta line, and the one colour on it is the status. */}
      <div
        className="mb-3.5 flex flex-wrap items-center gap-2 text-[12.5px]"
        style={{ color: "var(--text-soft)" }}
      >
        <span style={{ color: planStatusColour(plan.status), fontWeight: 600 }}>
          {planStatusLabel(plan.status)}
        </span>
        {plan.target_date ? (
          <>
            <span>·</span>
            <span>Due {shortDate(plan.target_date)}</span>
          </>
        ) : null}
        <span>·</span>
        <span>Urgency: {urgencyLabel(plan.urgency)}</span>
        <span>·</span>
        <span>{healthLabel(plan.health)}</span>
        <span>·</span>
        <span>Updated {relativeTime(plan.updated_at)}</span>
        {plan.approvalsWaiting > 0 ? (
          <span className="ml-1">
            <Pill tone="danger">
              {plan.approvalsWaiting} approval{plan.approvalsWaiting === 1 ? "" : "s"} pending
            </Pill>
          </span>
        ) : null}
      </div>

      <PlanProgressBar percent={plan.progress} done={plan.taskDone} total={plan.taskTotal} />

      <ViewLinks basePath={basePath} planName={plan.name} />

      <div className="mb-3 text-[14px] font-semibold">Work Streams ({plan.workstreams.length})</div>

      {plan.workstreams.length === 0 ? (
        <div
          className="rounded-card border-2 border-dashed p-8 text-center text-[13px]"
          style={{ borderColor: "var(--border-strong)", color: "var(--text-faint)" }}
        >
          Your team has not added any Work Streams to this plan yet.
        </div>
      ) : (
        <PlanStreamList
          streams={plan.workstreams}
          basePath={basePath}
          tick={
            canTick
              ? { requestId, returnTo: `/client-portal/requests/${requestId}?tab=plans` }
              : undefined
          }
        />
      )}
    </section>
  );
}

/**
 * WP.17's view switch, drawn as it is drawn there and pointing off this tab.
 *
 * List is where you already are, so it carries the switch's own active styling
 * and no link; the rest open the plan on that view. `PLAN_VIEWS` is Whitby's
 * list rather than a copy, so a view added there appears here.
 */
function ViewLinks({ basePath, planName }: { basePath: string; planName: string }) {
  return (
    <div className="mb-5 flex flex-wrap gap-1.5">
      {PLAN_VIEWS.map((view) => {
        const here = view.slug === "list";
        return here ? (
          <span
            key={view.slug}
            className="rounded-control px-3.5 py-1.5 text-[12.5px]"
            style={{ background: "var(--surface-active)", color: "var(--ink)", fontWeight: 600 }}
          >
            {view.label}
          </span>
        ) : (
          <Link
            key={view.slug}
            href={`${basePath}?view=${view.slug}`}
            aria-label={`${planName}, ${view.label} view`}
            className="rounded-control px-3.5 py-1.5 text-[12.5px] no-underline transition-colors"
            style={{ color: "var(--text-muted)" }}
          >
            {view.label}
          </Link>
        );
      })}
    </div>
  );
}
