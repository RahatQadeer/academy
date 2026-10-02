import Link from "next/link";
import { notFound } from "next/navigation";
import { Callout } from "@/base/components/Callout";
import { SendButton } from "@/whitbyos/requests/components/SendButton";
import { refineWorkplan } from "@/whitbyos/requests/actions";
import { getWorkplan, listRefineTurns } from "@/whitbyos/lib/workplan";
import { relativeTime } from "@/whitbyos/lib/format";
import { BackLink } from "@/whitbyos/components/BackLink";

const KIND_LABEL = { auto: "Auto", approval: "Approval", manual: "Manual" } as const;

/**
 * Screen 3.2.1 — Refine with Whitby.
 *
 * The conversation on the left is the plan's version history read back: every
 * refinement writes a version whose change reason is what was asked, so there
 * is one record rather than a chat log that can drift from the plan it
 * describes. Whitby's replies are stated from that record too — what it did,
 * not a stored sentence about what it did.
 */
export default async function RefinePlanPage({
  requestId,
  searchParams,
}: {
  requestId: string;
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const plan = await getWorkplan(requestId);
  if (!plan) notFound();

  const turns = await listRefineTurns(plan.id);
  const stepCount = plan.workstreams.reduce((n, s) => n + s.steps.length, 0);

  // The export marks the steps a refinement produced. Anything whose title was
  // not in the version before this one is new or reworded, which is exactly
  // what the professional needs to see at a glance.
  const before = new Set(turns.at(-2)?.stepNames ?? []);
  const changed = (title: string) => turns.length > 0 && !before.has(title);
  const error = Array.isArray(searchParams?.error)
    ? searchParams?.error[0]
    : searchParams?.error;

  const back = `/whitbyos/requests/${requestId}/plan`;

  return (
    <div className="flex h-[calc(100vh-1px)] flex-col overflow-hidden lg:flex-row">
      <div className="flex min-w-0 flex-1 flex-col px-5 py-5 sm:px-8 sm:py-6">
        <BackLink href={back} label="Back to the plan" />

        <div className="mb-3.5 text-[12.5px]" style={{ color: "var(--text-tertiary)" }}>
          <Link href="/whitbyos/requests" className="no-underline" style={{ color: "inherit" }}>
            Requests
          </Link>
          {" / New Request / "}
          <Link href={back} className="no-underline" style={{ color: "inherit" }}>
            Review Plan
          </Link>
          {" / "}
          <span style={{ color: "var(--ink)" }}>Refine with Whitby</span>
        </div>

        <div className="flex flex-1 flex-col gap-4 overflow-y-auto">
          <Bubble from="whitby" at={new Date().toISOString()}>
            Here&apos;s the plan I drafted, {plan.workstreams.length} work stream
            {plan.workstreams.length === 1 ? "" : "s"}, {stepCount} step
            {stepCount === 1 ? "" : "s"}. Want me to adjust anything before you run it?
          </Bubble>

          {turns.map((turn) => (
            <div key={turn.id} className="flex flex-col gap-4">
              <Bubble from="you" at={turn.at}>
                {turn.instruction}
              </Bubble>
              <Bubble from="whitby" at={turn.at}>
                Done, the updated plan is on the right.
              </Bubble>
            </div>
          ))}

          {error ? <Callout tone="danger">{error}</Callout> : null}
        </div>

        <form
          /* This screen is a page and navigates; the inline caller is the Ask
             Whitby panel, which gets an answer back instead. Wrapped because
             a <form action> must resolve to void. */
          action={async (formData: FormData) => {
            "use server";
            await refineWorkplan(formData);
          }}
          className="mt-4 flex items-center gap-2.5 rounded-[8px] border border-line-strong p-3"
        >
          <input type="hidden" name="request_id" value={requestId} />
          <input
            name="instruction"
            required
            placeholder="Tell Whitby what to change…"
            aria-label="Tell Whitby what to change"
            className="min-w-0 flex-1 border-none bg-transparent text-[14px] outline-none"
          />
          <SendButton />
        </form>
      </div>

      <aside className="w-full shrink-0 overflow-y-auto border-t border-line p-5 sm:p-6 lg:w-[380px] lg:border-l lg:border-t-0">
        <div className="mb-3 text-[13px] font-semibold">
          Updated plan · {plan.workstreams.length} Work Stream
          {plan.workstreams.length === 1 ? "" : "s"} ({stepCount} step
          {stepCount === 1 ? "" : "s"})
        </div>

        <div className="flex flex-col gap-3.5">
          {plan.workstreams.map((stream) => (
            <div key={stream.id}>
              <div
                className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.03em]"
                style={{ color: "rgba(55,53,47,.45)" }}
              >
                {stream.name}
              </div>
              <div className="flex flex-col gap-2">
                {stream.steps.map((step) => {
                  const isNew = changed(step.title);
                  return (
                    <div
                      key={step.id}
                      className="-mx-1.5 flex items-center gap-2.5 rounded-control px-1.5 py-1.5"
                      style={isNew ? { background: "var(--accent-tint-mid)" } : undefined}
                    >
                      <span
                        className="h-[18px] w-[18px] shrink-0 rounded-full border-[1.5px]"
                        style={{
                          borderColor: isNew ? "var(--accent)" : "var(--border-strong)",
                        }}
                        aria-hidden
                      />
                      <span
                        className="min-w-0 flex-1 text-[13px]"
                        style={isNew ? { fontWeight: 500 } : undefined}
                      >
                        {step.title}
                        <span
                          className="ml-1.5 text-[11.5px] font-normal"
                          style={{ color: "var(--text-tertiary)" }}
                        >
                          {KIND_LABEL[step.kind] ?? "Manual"}
                        </span>
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 flex gap-2.5">
          <Link
            href={back}
            className="flex-1 whitespace-nowrap rounded-control border border-line-strong px-3 py-[9px] text-center text-[13.5px] font-medium no-underline"
            style={{ color: "var(--ink)" }}
          >
            Back to plan
          </Link>
          <Link
            href={`/whitbyos/requests/${requestId}/plan?updated=1`}
            className="flex-1 whitespace-nowrap rounded-control px-3 py-[9px] text-center text-[13.5px] font-medium text-white no-underline hover:text-white"
            style={{ background: "var(--accent)" }}
          >
            Adopt as Workplan →
          </Link>
        </div>

        <p className="mt-2 text-center text-[11px]" style={{ color: "var(--text-disabled)" }}>
          Opens the updated plan for final approval before the run starts.
        </p>
      </aside>
    </div>
  );
}

function Bubble({
  from,
  at,
  children,
}: {
  from: "whitby" | "you";
  at: string;
  children: React.ReactNode;
}) {
  const mine = from === "you";
  return (
    <div className={`max-w-[420px] ${mine ? "self-end" : ""}`}>
      <div
        className="rounded-card px-3.5 py-3 text-[13.5px]"
        style={
          mine
            ? { background: "var(--accent)", color: "#fff" }
            : { background: "var(--surface-soft)", color: "var(--ink)" }
        }
      >
        {children}
      </div>
      <div
        className={`mt-1 text-[11.5px] ${mine ? "text-right" : ""}`}
        style={{ color: "var(--text-disabled)" }}
      >
        {mine ? "You" : "Whitby"} · {relativeTime(at)}
      </div>
    </div>
  );
}
