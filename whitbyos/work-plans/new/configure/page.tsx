import { notFound } from "next/navigation";
import { WizardChrome } from "@/whitbyos/components/WizardChrome";
import { ConfigureStep } from "@/whitbyos/work-plans/new/components/ConfigureStep";
import { getClient } from "@/whitbyos/lib/client-detail";
import { listRequestOptions } from "@/whitbyos/lib/tasks";

const LIST = "/whitbyos/work-plans";

/**
 * The drafting itself runs after the redirect — see `after` in
 * `buildWithWhitby` — and a server action's background work belongs to the
 * route that started it. Two model calls and a save need rather more than the
 * default segment budget, the same as the route that imports a plan.
 */
export const maxDuration = 300;
const STEPS = ["Choose how to build", "Configure", "Generate", "Review & Edit", "Save"];

function one(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

/** WP.4 and WP.5 — Build with Whitby, steps 2 and 3. */
export default async function ConfigurePlanPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  /* Empty is None: the firm's own work, or a plan drawn before the client it
     is for has accepted their invitation — 098. */
  const clientId = one(searchParams?.client) ?? "";

  const [client, allRequests] = await Promise.all([
    clientId ? getClient(clientId) : Promise.resolve(null),
    listRequestOptions(),
  ]);
  if (clientId && !client) notFound();

  /*
   * This client's Requests, and nobody else's.
   *
   * "Link to Request" was offering every Request in the firm, so a plan for
   * one family could be filed under another's visa application by one
   * mis-click, and the list read as a pile of unrelated work. The plan is
   * already for somebody; the Request it belongs to has to be theirs.
   */
  const requests = allRequests.filter((row) => (row.clientId ?? "") === clientId);

  return (
    <WizardChrome steps={STEPS} current={1} backHref={`${LIST}/new`} backLabel="Back">
      <ConfigureStep
        clientId={clientId}
        clientName={client?.name ?? null}
        requests={requests}
        name={one(searchParams?.name) ?? ""}
        error={one(searchParams?.error)}
        // Which attempt this is. The Generating view stays up until a new one
        // arrives, so two identical failures still put the form back.
        attempt={one(searchParams?.at) ?? ""}
      />
    </WizardChrome>
  );
}
