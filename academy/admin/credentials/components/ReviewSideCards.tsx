import type { AdminCredentialReview } from "../types";
import { certificateDesignNote, formatCredentialDate, credentialKindLabel } from "../lib/format";
import { ReviewActions } from "./ReviewActions";
import { Callout } from "@/base/components/Callout";
import { Pill } from "@/base/components/Pill";

export function ReviewSideCards({ detail }: { detail: AdminCredentialReview }) {
  const canDecide = detail.status === "credential_review";
  const requested = Boolean(detail.certificateRequestedAt);
  const typeLabel = credentialKindLabel(detail.type);

  return (
    <aside className="min-w-0 space-y-4 lg:self-start">
      {/* Decision first while reviewing — always in reach without fighting sticky height. */}
      {canDecide ? <ReviewActions credentialId={detail.id} /> : null}

      {canDecide && requested ? (
        <Callout tone="success" title="Learner requested certificate">
          Requested {formatCredentialDate(detail.certificateRequestedAt)}. Award to issue the
          certificate, or return it if more work is needed.
        </Callout>
      ) : null}

      {canDecide && !requested ? (
        <Callout tone="warning" title="Waiting on learner request">
          This credential is in review, but the learner has not clicked Request certificate yet. You
          can still award when ready.
        </Callout>
      ) : null}

      <section
        className="rounded-[12px] bg-white"
        style={{ border: "1px solid var(--border)" }}
      >
        <div
          className="border-b px-5 py-4"
          style={{
            borderColor: "var(--border)",
            background:
              detail.type === "cpa_credential"
                ? "color-mix(in srgb, var(--accent-tint) 70%, var(--surface))"
                : "var(--surface-subtle)",
          }}
        >
          <p
            className="text-[11px] font-semibold uppercase tracking-[0.06em]"
            style={{ color: "var(--text-tertiary)" }}
          >
            Certificate type
          </p>
          <div className="mt-2.5">
            <Pill tone={detail.type === "cpa_credential" ? "accent" : "neutral"}>{typeLabel}</Pill>
          </div>
        </div>

        <div className="space-y-4 px-5 py-4">
          <p className="text-[13.5px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
            {certificateDesignNote(detail.type)}
          </p>

          <dl className="space-y-3">
            <MetaRow label="Learner" value={detail.learnerName} />
            <MetaRow label="Program" value={detail.credentialName} />
            <MetaRow label="Term" value={detail.termLabel} />
          </dl>

          {requested ? (
            <div
              className="flex items-center justify-between gap-2 rounded-[8px] px-3 py-2.5"
              style={{
                background: "color-mix(in srgb, var(--accent-tint) 55%, var(--surface))",
                border: "1px solid color-mix(in srgb, var(--accent) 18%, var(--border))",
              }}
            >
              <span className="text-[12.5px] font-medium" style={{ color: "var(--ink)" }}>
                Certificate requested
              </span>
              <span className="text-[12px] tabular-nums" style={{ color: "var(--text-tertiary)" }}>
                {formatCredentialDate(detail.certificateRequestedAt)}
              </span>
            </div>
          ) : null}
        </div>
      </section>

      <section
        className="rounded-[12px] bg-white p-5"
        style={{ border: "1px solid var(--border)" }}
      >
        <h3
          className="text-[14.5px] font-semibold tracking-[-0.2px]"
          style={{ color: "var(--ink)" }}
        >
          Timeline
        </h3>
        {detail.timeline.length === 0 ? (
          <p className="mt-3 text-[13.5px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
            Timeline dates appear as learning, assessments, and review are recorded.
          </p>
        ) : (
          <ol className="relative mt-4">
            {detail.timeline.map((event, index) => {
              const isLast = index === detail.timeline.length - 1;
              return (
                <li key={event.id} className="relative flex gap-3 pb-4 last:pb-0">
                  {!isLast ? (
                    <span
                      aria-hidden
                      className="absolute left-[5px] top-3 bottom-0 w-px"
                      style={{ background: "var(--border-strong)" }}
                    />
                  ) : null}
                  <span
                    aria-hidden
                    className="relative z-[1] mt-1.5 h-[11px] w-[11px] shrink-0 rounded-full"
                    style={{
                      background: "var(--surface)",
                      border: "2px solid var(--accent)",
                      boxShadow: "0 0 0 3px color-mix(in srgb, var(--accent-tint) 80%, transparent)",
                    }}
                  />
                  <div className="min-w-0 pt-0.5">
                    <p className="text-[13.5px] font-medium leading-snug" style={{ color: "var(--ink)" }}>
                      {event.label}
                    </p>
                    <p
                      className="mt-0.5 text-[12.5px] tabular-nums"
                      style={{ color: "var(--text-tertiary)" }}
                    >
                      {formatCredentialDate(event.at)}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </section>

      {!canDecide && detail.reviewNote ? (
        <section
          className="rounded-[12px] bg-white p-5"
          style={{ border: "1px solid var(--border)" }}
        >
          <h3
            className="text-[14.5px] font-semibold tracking-[-0.2px]"
            style={{ color: "var(--ink)" }}
          >
            {detail.reviewNoteAction === "return" ? "Note sent to learner" : "Reviewer note"}
          </h3>
          <p
            className="mt-3 whitespace-pre-wrap text-[13.5px] leading-relaxed"
            style={{ color: "var(--ink)" }}
          >
            {detail.reviewNote}
          </p>
        </section>
      ) : null}
    </aside>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt
        className="text-[11px] font-semibold uppercase tracking-[0.05em]"
        style={{ color: "var(--text-tertiary)" }}
      >
        {label}
      </dt>
      <dd className="mt-0.5 text-[13.5px] leading-snug text-pretty" style={{ color: "var(--ink)" }}>
        {value}
      </dd>
    </div>
  );
}
