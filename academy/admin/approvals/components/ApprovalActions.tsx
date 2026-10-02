"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/base/components/Button";
import { Callout } from "@/base/components/Callout";
import { reviewPublishRequestAction } from "../actions";
import { NOTES_MAX } from "../../types";
import type { ReviewDecision } from "../../types";

export function ApprovalActions({ requestId }: { requestId: string }) {
  const router = useRouter();
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<ReviewDecision | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(decision: ReviewDecision) {
    startTransition(async () => {
      setError(null);
      const result = await reviewPublishRequestAction({
        requestId,
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
      <Callout
        tone={done === "approved" ? "success" : "warning"}
        title={done === "approved" ? "Approved" : "Returned for edits"}
      >
        {done === "approved"
          ? "The request is approved. Publishing is a separate step and is available on this page."
          : "Sent back to the instructor for changes. The program was not published."}
      </Callout>
    );
  }

  return (
    <section
      className="rounded-[10px] bg-surface p-5"
      style={{ border: "1px solid var(--border)" }}
    >
      <h2 className="text-[13.5px] font-medium">Review</h2>
      <p className="mt-1 text-[13px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
        Approval does not publish this program to the catalog.
      </p>
      <label className="mt-4 block">
        <span
          className="mb-1.5 block text-[12.5px] font-medium uppercase tracking-[0.05em]"
          style={{ color: "var(--text-tertiary)" }}
        >
          Notes (optional)
        </span>
        <textarea
          value={notes}
          maxLength={NOTES_MAX}
          rows={4}
          disabled={pending}
          className="w-full rounded-[6px] border bg-surface px-3 py-[9px] text-[14.5px] text-ink"
          style={{ borderColor: "var(--border-strong)" }}
          onChange={(event) => setNotes(event.target.value)}
        />
      </label>
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
