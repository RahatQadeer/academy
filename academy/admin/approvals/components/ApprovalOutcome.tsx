import Link from "next/link";
import { Button } from "@/base/components/Button";
import { ApprovalSequence } from "./ApprovalSequence";
import { ApprovalStageStatus } from "./ApprovalStageStatus";
import { approvalsQueueHref } from "../utils/labels";
import type { QueueStatusFilter } from "../../types";

export type ApprovalOutcomeModel = {
  kind: "published" | "returned";
  requestId: string;
  programId: string;
  programName: string;
  sectionLabel: string;
  specialty: string;
  instructor: string;
  whenLabel: string;
  notes: string;
};

function MetaRow({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div className="grid grid-cols-1 gap-1 py-3 sm:grid-cols-[9.5rem_minmax(0,1fr)] sm:gap-4 sm:py-3.5">
      <dt className="text-[12.5px] font-medium" style={{ color: "var(--text-tertiary)" }}>
        {label}
      </dt>
      <dd className="text-[14px] font-medium leading-snug text-pretty" style={{ color: "var(--ink)" }}>
        {value}
      </dd>
    </div>
  );
}

function CheckItem({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-2.5 text-[14px] leading-relaxed" style={{ color: "var(--ink)" }}>
      <span
        className="mt-0.5 inline-flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full"
        style={{ background: "var(--success-bg)", color: "var(--success-fg)" }}
        aria-hidden
      >
        <svg width="10" height="10" viewBox="0 0 11 11" fill="none">
          <path
            d="M2 5.6L4.4 8L9 3"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      <span>{children}</span>
    </li>
  );
}

function NextItem({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-2.5 text-[14px] leading-relaxed" style={{ color: "var(--ink)" }}>
      <span
        className="mt-[7px] size-1.5 shrink-0 rounded-full"
        style={{ background: "var(--warning-fg)" }}
        aria-hidden
      />
      <span>{children}</span>
    </li>
  );
}

export function ApprovalOutcome({ model }: { model: ApprovalOutcomeModel }) {
  const published = model.kind === "published";
  const stage: QueueStatusFilter = published ? "published" : "returned";
  const queueHref = approvalsQueueHref(stage);
  const requestHref = `/academy/admin/approvals/${model.requestId}`;
  const exploreHref = model.programId ? `/academy/explore/${model.programId}` : "/academy/explore";
  const catalogHref = model.programId ? `/academy/admin/catalog/${model.programId}` : "/academy/admin/programs";

  return (
    <div className="mx-auto max-w-[1080px] px-6 py-10 lg:px-10">
      <Link
        href={queueHref}
        className="text-[13.5px] no-underline hover:text-accent-hover"
        style={{ color: "var(--text-secondary)" }}
      >
        ← Publish Approvals
      </Link>

      <header className="mt-5 space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="text-[12px] font-medium" style={{ color: "var(--text-tertiary)" }}>
              {published ? "Publish sequence complete" : "Returned for edits"}
            </p>
            <h1 className="mt-1.5 text-[24px] font-bold leading-snug tracking-[-0.35px] text-pretty sm:text-[26px]">
              {published ? "Approved and published" : "Changes requested"}
            </h1>
            <p className="mt-1.5 max-w-2xl text-[14px] leading-relaxed text-pretty" style={{ color: "var(--text-secondary)" }}>
              {published
                ? `${model.programName} is live in Explore. ${model.instructor} has been notified.`
                : `${model.sectionLabel || model.programName} was returned to ${model.instructor} for edits. It will reappear under Needs review when they submit again.`}
            </p>
          </div>
          <div className="shrink-0 sm:pt-1">
            <ApprovalStageStatus stage={stage} />
          </div>
        </div>
        <ApprovalSequence stage={stage} />
      </header>

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_280px] lg:items-start">
        <section
          className="overflow-hidden rounded-[12px] bg-surface"
          style={{ border: "1px solid var(--border)" }}
        >
          <div
            className="flex items-start gap-3.5 border-b px-5 py-4 sm:px-6"
            style={{
              borderColor: "var(--border)",
              background: published ? "var(--success-bg)" : "var(--warning-bg)",
            }}
          >
            <span
              className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface"
              style={{ color: published ? "var(--success-fg)" : "var(--warning-fg)" }}
              aria-hidden
            >
              {published ? (
                <svg width="18" height="18" viewBox="0 0 28 28" fill="none">
                  <path
                    d="M7 14.5L11.5 19L21 9"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M8 6L4 10L8 14M16 18L20 14L16 10"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
            </span>
            <div className="min-w-0">
              <p
                className="text-[11px] font-semibold uppercase tracking-[0.08em]"
                style={{ color: published ? "var(--success-fg)" : "var(--warning-fg)" }}
              >
                {published ? "Now live" : "Awaiting resubmit"}
              </p>
              <h2 className="mt-1 text-[17px] font-semibold tracking-[-0.02em] text-pretty">
                {model.programName}
              </h2>
            </div>
          </div>

          <dl className="px-5 [&>*+*]:border-t [&>*+*]:border-line sm:px-6">
            <MetaRow label="Section" value={model.sectionLabel} />
            <MetaRow label="Specialty" value={model.specialty} />
            <MetaRow label="Instructor" value={model.instructor} />
            <MetaRow label={published ? "Published" : "Returned for edits"} value={model.whenLabel} />
          </dl>

          {model.notes ? (
            <div className="border-t px-5 py-4 sm:px-6" style={{ borderColor: "var(--border)" }}>
              <p
                className="text-[11px] font-semibold uppercase tracking-[0.07em]"
                style={{ color: "var(--text-tertiary)" }}
              >
                Feedback sent
              </p>
              <p className="mt-2 text-[14px] leading-relaxed text-pretty" style={{ color: "var(--ink)" }}>
                {model.notes}
              </p>
            </div>
          ) : null}

          <div className="border-t px-5 py-4 sm:px-6" style={{ borderColor: "var(--border)" }}>
            <p
              className="text-[11px] font-semibold uppercase tracking-[0.07em]"
              style={{ color: "var(--text-tertiary)" }}
            >
              What this means
            </p>
            <ul className="mt-3 space-y-2.5">
              {published ? (
                <>
                  <CheckItem>Learners can find and enroll in this program from Explore.</CheckItem>
                  <CheckItem>{model.instructor} has been notified that it is live.</CheckItem>
                  <CheckItem>Further edits need a new publish request before they go live.</CheckItem>
                </>
              ) : (
                <>
                  <NextItem>
                    {model.instructor} can edit the flagged section and submit again.
                  </NextItem>
                  <NextItem>It stays out of the review queue until that resubmit.</NextItem>
                  <NextItem>Nothing was published to Explore.</NextItem>
                </>
              )}
            </ul>
          </div>

          <div
            className="flex flex-wrap gap-2 border-t px-5 py-4 sm:px-6"
            style={{ borderColor: "var(--border)", background: "var(--surface-soft)" }}
          >
            {published ? (
              <>
                <Button href={exploreHref} variant="primary">
                  View in Explore
                </Button>
                <Button href={catalogHref} variant="secondary">
                  Open program
                </Button>
              </>
            ) : (
              <>
                <Button href={requestHref} variant="primary">
                  Open this request
                </Button>
                <Button href={queueHref} variant="secondary">
                  View returned for edits
                </Button>
              </>
            )}
          </div>
        </section>

        <aside className="space-y-4">
          <section
            className="rounded-[10px] bg-surface px-5 py-4"
            style={{ border: "1px solid var(--border)" }}
          >
            <h2
              className="text-[11px] font-semibold uppercase tracking-[0.07em]"
              style={{ color: "var(--text-tertiary)" }}
            >
              Next
            </h2>
            <p className="mt-2 text-[13.5px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
              {published
                ? "The program is in the live queue. You can confirm the learner listing or return to other requests."
                : "When the instructor submits again, this request returns to Review."}
            </p>
            <Link
              href={published ? queueHref : "/academy/admin/approvals"}
              className="mt-3 inline-block text-[13.5px] font-medium no-underline hover:text-accent-hover"
              style={{ color: "var(--accent)" }}
            >
              {published ? "All live programs →" : "Back to Review →"}
            </Link>
          </section>
        </aside>
      </div>
    </div>
  );
}
