"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { decideDeletion, type DecisionResult } from "@/whitbyos/notifications/actions";

/**
 * Accept or decline one request to delete something.
 *
 * Both answers live in one form so the pair share an outcome: once either is
 * pressed the question is over, and what replaces it is what happened.
 *
 * Accepting is drawn as the destructive one, because it is the press that
 * destroys the record — whoever asked for it.
 */
export function DecideDeletion({
  requestId,
  acceptLabel = "Accept",
  declineLabel = "Decline",
}: {
  requestId: string;
  acceptLabel?: string;
  declineLabel?: string;
}) {
  const [result, action] = useActionState<DecisionResult, FormData>(decideDeletion, null);

  if (result) {
    return (
      <p
        role="status"
        className="text-[12px]"
        style={{ color: result.ok ? "var(--success-fg)" : "var(--danger-text)" }}
      >
        {result.message}
      </p>
    );
  }

  return (
    <form action={action} className="flex items-center gap-2">
      <input type="hidden" name="request_id" value={requestId} />
      <Choice value="decline" label={declineLabel} quiet />
      <Choice value="accept" label={acceptLabel} />
    </form>
  );
}

function Choice({
  value,
  label,
  quiet,
}: {
  value: "accept" | "decline";
  label: string;
  quiet?: boolean;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      name="decision"
      value={value}
      disabled={pending}
      className="rounded-control border px-3 py-[6px] text-[12.5px] font-medium disabled:opacity-60"
      style={
        quiet
          ? { borderColor: "var(--border-strong)", background: "var(--surface)", color: "var(--ink)" }
          : {
              borderColor: "var(--danger-action-border)",
              background: "var(--danger-action-bg)",
              color: "var(--danger-action-fg)",
            }
      }
    >
      {pending ? "Working…" : label}
    </button>
  );
}
