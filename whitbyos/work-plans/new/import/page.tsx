import { notFound } from "next/navigation";
import { WizardChrome } from "@/whitbyos/components/WizardChrome";
import { ImportStep } from "@/whitbyos/work-plans/new/import/components/ImportStep";
import { getClient } from "@/whitbyos/lib/client-detail";

const LIST = "/whitbyos/work-plans";
// WP.12's own header names the same five steps every generated path uses,
// even though on this one "Configure" is the upload and "Generate" the parse.
const STEPS = ["Choose how to build", "Configure", "Generate", "Review & Edit", "Save"];

/**
 * A scan is read by the model and then drafted by it — two calls, and the
 * default segment budget covers neither. The route that generates the Academy
 * catalogue already asks for the same.
 */
export const maxDuration = 300;

function one(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

/** WP.12 and WP.13 — Import a Work Plan, steps 2 and 3. */
export default async function ImportPlanPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  /* No client is an answer — 099. An imported plan can be the firm's own
     work, or work agreed before the client it is for has accepted their
     invitation. */
  const clientId = one(searchParams?.client) ?? "";

  const client = clientId ? await getClient(clientId) : null;
  if (clientId && !client) notFound();

  return (
    <WizardChrome steps={STEPS} current={1} backHref={`${LIST}/new`} backLabel="Back">
      <ImportStep
        clientId={clientId}
        clientName={client?.name ?? null}
        name={one(searchParams?.name) ?? ""}
        error={one(searchParams?.error)}
      />
    </WizardChrome>
  );
}
