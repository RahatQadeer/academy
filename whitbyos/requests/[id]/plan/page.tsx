import { SubmitPlain } from "@/base/components/Submit";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Pill } from "@/base/components/Pill";
import { createClient } from "@/base/lib/supabase/server";
import { getWorkplan, listRefineTurns, type WorkstreamKind } from "@/whitbyos/lib/workplan";
import { activateWorkplan } from "@/whitbyos/requests/actions";
import { urgencyLabel } from "@/whitbyos/work-plans/components/PlanMeters";
import { relativeTime, shortDate } from "@/whitbyos/lib/format";
import type { Urgency } from "@/whitbyos/lib/work-plans";
import { BackLink } from "@/whitbyos/components/BackLink";

const KIND: Record<WorkstreamKind, { tone: "success" | "warning" | "neutral"; label: string }> = {
  auto: { tone: "success", label: "Auto" },
  approval: { tone: "warning", label: "Approval" },
  manual: { tone: "neutral", label: "Manual" },
};

/**
 * Screens 3.2 and 3.2.2 — the professional reviews what Whitby drafted before
 * anything becomes live work (§6.5.1).
 *
 * Two levels, as the export draws them: Work Streams as cards, and the steps
 * inside each carrying the Auto / Approval / Manual classification. The
 * classification is on the step because that is the question §1.15 actually
 * asks — whether this piece of work may happen without a person. "Housing
 * Search" is neither auto nor manual; "draft the shortlist" is.
 *
 * 3.2.2 is this screen after a refinement: the same plan, marked as updated,
 * with a way back into the conversation.
 */
export default async function PlanReviewPage({
  requestId,
  searchParams,
}: {
  requestId: string;
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const one = (value: string | string[] | undefined) =>
    Array.isArray(value) ? value[0] : value;

  const updated = one(searchParams?.updated) === "1";

  const supabase = await createClient();
  const { data: request } = await supabase
    .from("whitbyos_requests")
    .select(
      "id, title, desired_outcome, status, urgency, target_date, client:whitbyos_clients!client_id (id, name)",
    )
    .eq("id", requestId)
    .maybeSingle();

  if (!request) notFound();

  const plan = await getWorkplan(requestId);
  if (!plan) notFound();

  const client = Array.isArray(request.client) ? request.client[0] : request.client;
  const lastChange = updated ? (await listRefineTurns(plan.id)).at(-1) : null;
  const touchedStreams = new Set(lastChange?.changedStreams ?? []);
  const stepChange = (title: string) => lastChange?.changes[title] ?? null;

  const stepCount = plan.workstreams.reduce((n, s) => n + s.steps.length, 0);
  const approvals = plan.workstreams.flatMap((s) =>
    s.steps.filter((step) => step.kind === "approval"),
  );

  const requestHref = `/whitbyos/requests/${requestId}`;
  const refineHref = `${requestHref}/plan/refine`;

  return (
    <div className="px-5 py-5 sm:px-8 sm:py-7 xl:px-12">
      <BackLink href={requestHref} label="Back to the Request" />

      <div className="mb-2.5 text-[12.5px]" style={{ color: "var(--text-tertiary)" }}>
        <Link href="/whitbyos/requests" className="no-underline" style={{ color: "inherit" }}>
          Requests
        </Link>
        {" / New Request / "}
        {updated ? (
          <>
            <Link href={refineHref} className="no-underline" style={{ color: "inherit" }}>
              Review Plan
            </Link>
            {" / Refine with Whitby / "}
            <span style={{ color: "var(--ink)" }}>Updated Plan</span>
          </>
        ) : (
          <span style={{ color: "var(--ink)" }}>Review Plan</span>
        )}
      </div>

      <div className="mb-[18px] flex items-start justify-between gap-6">
        <div className="min-w-0 flex-1">
          <div className="mb-1.5 flex items-center gap-2.5">
            <h1 className="text-[23px] font-bold">{plan.name}</h1>
            <Pill tone="accent">{updated ? "Updated by Whitby" : "Drafted by Whitby"}</Pill>
          </div>
          <p
            className="max-w-[640px] text-[13px] leading-[1.5]"
            style={{ color: "var(--text-secondary)" }}
          >
            {lastChange
              ? `You asked: “${lastChange.instruction}”`
              : plan.desired_outcome || (request.desired_outcome as string) || ""}
          </p>
        </div>

        <div className="flex shrink-0 gap-2">
          <Link
            href={requestHref}
            className="whitespace-nowrap rounded-control border border-line-strong bg-surface px-4 py-[9px] text-[13.5px] font-medium no-underline"
            style={{ color: "var(--ink)" }}
          >
            Save for later
          </Link>

          <Link
            href={refineHref}
            className="whitespace-nowrap rounded-control border border-line-strong bg-surface px-4 py-[9px] text-[13.5px] font-medium no-underline"
            style={{ color: "var(--ink)" }}
          >
            {updated ? "Keep refining" : "Refine with Whitby"}
          </Link>

          <form action={activateWorkplan}>
            <input type="hidden" name="request_id" value={requestId} />
            <input type="hidden" name="workplan_id" value={plan.id} />
            <SubmitPlain
             
              className="whitespace-nowrap rounded-control px-4 py-[9px] text-[13.5px] font-medium text-white"
              style={{ background: "var(--accent)" }}
            >
              {updated ? "Approve & Run →" : "Run this plan"}
            </SubmitPlain>
          </form>
        </div>
      </div>

      <div className="mb-5 flex flex-wrap gap-2.5">
        <Pill>Draft · not yet run</Pill>
        <Pill tone="warning">
          Urgency: {urgencyLabel(((request.urgency as string) ?? "medium") as Urgency)}
        </Pill>
        <Pill>
          {plan.workstreams.length} Work Stream{plan.workstreams.length === 1 ? "" : "s"} ·{" "}
          {stepCount} step{stepCount === 1 ? "" : "s"}
        </Pill>
      </div>

      <div className="flex flex-col gap-6 lg:flex-row">
        <div className="flex min-w-0 flex-1 flex-col gap-3.5">
          <span className="text-[14px] font-semibold">
            Work Streams ({plan.workstreams.length})
          </span>

          {plan.workstreams.map((stream, index) => {
            const touched = touchedStreams.has(stream.name);

            return (
              <div
                key={stream.id}
                className="overflow-hidden rounded-card border"
                style={{ borderColor: touched ? "var(--accent)" : "var(--border)" }}
              >
                <div
                  className="flex items-center gap-2.5 px-3.5 py-3"
                  style={{
                    background: touched ? "var(--accent-tint-mid)" : "var(--surface-soft)",
                  }}
                >
                  <span
                    className="text-[11px]"
                    style={{ color: "var(--text-disabled)" }}
                    aria-hidden
                  >
                    ▾
                  </span>
                  <span
                    className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-[6px] text-[11px] font-bold"
                    style={
                      touched
                        ? { background: "var(--accent)", color: "#fff" }
                        : { background: "var(--accent-tint)", color: "var(--accent)" }
                    }
                  >
                    {index + 1}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[14px] font-semibold">
                    {stream.name}
                  </span>
                  {touched ? (
                    <span
                      className="shrink-0 whitespace-nowrap rounded px-[7px] py-[2px] text-[10.5px] font-medium text-white"
                      style={{ background: "var(--accent)" }}
                    >
                      Updated
                    </span>
                  ) : (
                    <Pill>
                      {stream.steps.length} step{stream.steps.length === 1 ? "" : "s"}
                    </Pill>
                  )}
                </div>

                <div className="flex flex-col gap-2.5 py-1.5 pl-[46px] pr-3.5 pb-3">
                  {stream.steps.length === 0 ? (
                    <p className="text-[13.5px]" style={{ color: "var(--text-tertiary)" }}>
                      No steps in this work stream.
                    </p>
                  ) : (
                    stream.steps.map((step, stepIndex) => {
                      const kind = KIND[step.kind] ?? KIND.manual;
                      const change = stepChange(step.title);

                      return (
                        <div
                          key={step.id}
                          className="-mx-2 flex items-center gap-3 rounded-[8px] px-2 py-1.5"
                          style={change ? { background: "var(--surface)" } : undefined}
                        >
                          <span
                            className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border-[1.5px] text-[10px]"
                            style={{
                              borderColor: change ? "var(--accent)" : "var(--border-strong)",
                              color: change ? "var(--accent)" : "var(--text-tertiary)",
                            }}
                          >
                            {offsetOf(plan.workstreams, index) + stepIndex + 1}
                          </span>
                          <span
                            className="min-w-0 flex-1 text-[13.5px]"
                            style={change ? { color: "var(--info-fg)", fontWeight: 500 } : undefined}
                          >
                            {step.title}
                            {change ? (
                              <span
                                className="ml-1 text-[11px] font-medium"
                                style={{ color: "var(--accent)" }}
                              >
                                · {change}
                              </span>
                            ) : null}
                          </span>
                          <Pill tone={kind.tone}>{kind.label}</Pill>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <aside className="flex w-full shrink-0 flex-col gap-4 lg:w-[280px]">
          <Panel title="Key Dates">
            <div>
              {updated ? "Updated" : "Drafted"}{" "}
              {relativeTime(updated ? lastChange?.at ?? plan.created_at : plan.created_at)}
            </div>
            <div>
              {request.target_date
                ? `Target ${shortDate(request.target_date as string)}`
                : "No target date set yet"}
            </div>
          </Panel>

          <Panel title="Contacts &amp; Approvals">
            <div>{client?.name ?? "No client"} · Client</div>
            {approvals.length > 0 ? (
              <div style={{ color: "var(--warning-fg)" }}>
                {approvals.length} approval{approvals.length === 1 ? "" : "s"} on run:{" "}
                {approvals.map((step) => step.title).join(", ")}
              </div>
            ) : (
              <div>Nothing needs approval before this runs.</div>
            )}
          </Panel>

          <Panel title="Linked">
            <div>Request: {request.title as string}</div>
            <div>Client: {client?.name ?? "No client"}</div>
          </Panel>
        </aside>
      </div>
    </div>
  );
}

/** Steps are numbered across the whole plan, not restarted per work stream. */
function offsetOf(streams: { steps: unknown[] }[], index: number) {
  return streams.slice(0, index).reduce((n, s) => n + s.steps.length, 0);
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-[8px] border border-line p-4">
      <div className="mb-2.5 text-[13px] font-semibold">{title}</div>
      <div className="text-[12.5px] leading-[1.9]" style={{ color: "var(--text-secondary)" }}>
        {children}
      </div>
    </div>
  );
}
