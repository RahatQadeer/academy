import { notFound, redirect } from "next/navigation";
import { BackLink } from "@/whitbyos/components/BackLink";
import { getWorkPlan } from "@/whitbyos/lib/work-plans";
import { getClientAsk } from "@/whitbyos/lib/client-ask";
import { usesClientWorkspaces } from "@/whitbyos/lib/client-workspace";
import { ClientNeedsPanel } from "@/whitbyos/work-plans/[id]/components/ClientNeedsPanel";

type SearchParams = Record<string, string | string[] | undefined>;

function one(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * The Client Checklist, on a screen of its own.
 *
 * It was a panel on the plan, above the work and below the deadline, and it
 * is the longest thing on that page: everything the client has to send
 * before anything can start, one row each, with an approval on every row.
 * On a plan with fourteen of them it pushed the Work Streams off the first
 * screen, and it is not what somebody opens a plan to look at.
 *
 * So the plan carries a card that says how many are outstanding, and this is
 * where the list lives. Nothing about the list changed: it is the same
 * component, the same approvals, the same one message and one form at the
 * end, given the room it always needed.
 */
export default async function ClientChecklistPage({
  planId,
  searchParams,
}: {
  planId: string;
  searchParams?: SearchParams;
}) {
  const plan = await getWorkPlan(planId);
  if (!plan) notFound();

  const showClients = await usesClientWorkspaces();

  /* The firm's own work has nobody to ask, so this screen has nothing on
     it. No card leads here from such a plan; a typed or shared link is
     what this catches. */
  if (!showClients || !plan.client_id) redirect(`/whitbyos/work-plans/${plan.id}`);
  const { ask, edits, proposals } = await getClientAsk(planId);

  const basePath = `/whitbyos/work-plans/${plan.id}`;
  const here = `${basePath}/checklist`;

  return (
    <div className="px-5 py-6 sm:px-8 sm:py-9 xl:px-12">
      <BackLink href={basePath} label={`Back to ${plan.name}`} />

      <div className="mb-5">
        <h1 className="text-[24px] font-bold leading-tight tracking-[-0.3px]">
          Client Checklist
        </h1>
        <p className="mt-1.5 text-[13.5px]" style={{ color: "var(--text-tertiary)" }}>
          {plan.name}
          {plan.client_name && plan.client_name !== "No client"
            ? ` · ${plan.client_name}`
            : ""}
        </p>
      </div>

      <ClientNeedsPanel
        planId={plan.id}
        /* The firm's own work has nobody to ask (migration 099). */
        hasClient={Boolean(plan.client_id)}
        streams={plan.workstreams}
        ask={ask}
        edits={edits}
        proposals={proposals}
        /* The page is this panel. A lid here is a button that empties the
           screen, and the panel's own title would be the second one on it. */
        lid={false}
        /* Approving from here comes back to here, not to the plan: this
           screen is a sitting of several approvals, and returning to the
           plan after each one would be the list closing under you. */
        returnTo={here}
        justAsked={Number(one(searchParams?.asked)) || null}
        justReminded={one(searchParams?.reminded) === "1"}
        error={one(searchParams?.ask) === "1" ? (one(searchParams?.error) ?? null) : null}
      />
    </div>
  );
}
