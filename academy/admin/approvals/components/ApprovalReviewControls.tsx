"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/base/components/Button";
import { Callout } from "@/base/components/Callout";
import type { ApprovalRequestDetail, ReviewDecision } from "../../types";
import { NOTES_MAX } from "../../types";
import { reviewPublishRequestAction } from "../actions";
import { approvalStage } from "../utils/labels";
import { PublishApprovedButton } from "./PublishApprovedButton";

export function ApprovalReviewControls({ detail }: { detail: ApprovalRequestDetail }) {
  const router = useRouter();
  const [notes, setNotes] = useState(detail.notes ?? "");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<ReviewDecision | null>(null);
  const [pending, startTransition] = useTransition();
  const stage = approvalStage({
    status: detail.status,
    programStatus: detail.program.status,
    publishedAt: detail.publishedAt,
  });

  function submit(decision: ReviewDecision) {
    startTransition(async () => {
      setError(null);
      const result = await reviewPublishRequestAction({
        requestId: detail.id,
        decision,
        notes,
      });
      if (!result.ok) {
        setError(result.message || "This request could not be reviewed.");
        return;
      }
      setDone(result.status);
      router.refresh();
    });
  }

  if (done) {
    return (
      <section
        className="rounded-[10px] bg-surface px-5 py-4"
        style={{ border: "1px solid var(--border)" }}
      >
        <Callout
          tone={done === "approved" ? "success" : "warning"}
          title={done === "approved" ? "Approved — next, publish" : "Returned for edits"}
        >
          {done === "approved"
            ? "Review is complete. Publishing is a separate step and can be done by you or the instructor."
            : "The program was not published. It will return here when the instructor submits again."}
        </Callout>
        {done === "approved" && detail.program.status !== "published" ? (
          <div className="mt-4">
            <PublishApprovedButton requestId={detail.id} embedded />
          </div>
        ) : null}
      </section>
    );
  }

  if (stage === "published") {
    return (
      <section
        className="overflow-hidden rounded-[12px] bg-surface"
        style={{ border: "1px solid var(--border)" }}
      >
        <div className="px-5 py-4">
          <Callout tone="success" title="Sequence complete">
            This program is live in Explore. No further approval action is required.
          </Callout>
        </div>
      </section>
    );
  }

  if (stage === "returned") {
    return (
      <section
        className="rounded-[10px] bg-surface px-5 py-4"
        style={{ border: "1px solid var(--border)" }}
      >
        <Callout tone="warning" title="Waiting on the instructor">
          This submission was returned. It stays out of review until they submit again.
        </Callout>
        {detail.notes ? (
          <p className="mt-3 text-[13px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
            {detail.notes}
          </p>
        ) : null}
      </section>
    );
  }

  if (stage === "ready") {
    return (
      <section
        className="rounded-[10px] bg-surface px-5 py-4"
        style={{ border: "1px solid var(--border)" }}
      >
        <h2
          className="text-[11px] font-semibold uppercase tracking-[0.07em]"
          style={{ color: "var(--text-tertiary)" }}
        >
          Publish
        </h2>
        <p className="mt-2 text-[13px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
        Step 2 — Review is done. Publishing adds the program to the learner catalog. You or the
          instructor can complete this step.
        </p>
        <PublishApprovedButton requestId={detail.id} embedded />
      </section>
    );
  }

  return (
    <section
      className="rounded-[10px] bg-surface px-5 py-4"
      style={{ border: "1px solid var(--border)" }}
    >
      <h2
        className="text-[11px] font-semibold uppercase tracking-[0.07em]"
        style={{ color: "var(--text-tertiary)" }}
      >
        Review
      </h2>
      <p className="mt-2 text-[13px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
        Approve to unlock publishing, or return for edits so the instructor can revise.
        Approval alone does not make the program live.
      </p>
      <textarea
        value={notes}
        maxLength={NOTES_MAX}
        rows={4}
        disabled={pending}
        placeholder="Private notes while you review — not shared with the instructor."
        className="mt-3 w-full rounded-[8px] border bg-surface px-3 py-2.5 text-[13.5px] leading-relaxed text-ink placeholder:text-[rgba(55,53,47,0.38)]"
        style={{ borderColor: "var(--border-strong)" }}
        onChange={(event) => setNotes(event.target.value)}
      />
      {error ? (
        <p className="mt-3 text-[13px]" style={{ color: "var(--danger-fg)" }}>
          {error}
        </p>
      ) : null}
      <div className="mt-4 flex flex-wrap gap-2">
        <Button variant="primary" disabled={pending} onClick={() => submit("approved")}>
          {pending ? "Saving…" : "Approve"}
        </Button>
        <Button variant="secondary" disabled={pending} onClick={() => submit("rejected")}>
          Return for edits
        </Button>
      </div>
    </section>
  );
}
