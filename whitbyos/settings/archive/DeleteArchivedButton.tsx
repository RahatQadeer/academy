"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { deleteArchived, type DeleteResult } from "@/whitbyos/settings/archive/actions";

/**
 * The one control in Whitby that destroys something, and it says which of the
 * two things it will do before it is pressed.
 *
 * Within fifteen minutes of a record being made it deletes outright. After
 * that, for anything belonging to a client, it asks them and waits — so it says
 * "Ask to delete", because a button labelled Delete that does not delete is
 * worse than either word alone.
 *
 * The outcome is shown here rather than raised as a toast: this screen is the
 * one the action would have redirected to, and a server action redirecting to
 * its own path does not move the router.
 */
export function DeleteArchivedButton({
  id,
  type,
  asks,
  minutesLeft,
}: {
  id: string;
  type: string;
  asks: boolean;
  /** How much of the fifteen minutes is left, when there is any. */
  minutesLeft: number;
}) {
  const [result, action] = useActionState<DeleteResult, FormData>(deleteArchived, null);

  return (
    <form action={action} className="inline-flex items-center gap-2">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="type" value={type} />
      <Button asks={asks} minutesLeft={minutesLeft} done={Boolean(result?.ok)} />
      {result ? (
        <span
          role="status"
          className="max-w-[170px] truncate text-[11px]"
          style={{ color: result.ok ? "var(--success-fg)" : "var(--danger-text)" }}
          title={result.message}
        >
          {result.message}
        </span>
      ) : null}
    </form>
  );
}

function Button({
  asks,
  minutesLeft,
  done,
}: {
  asks: boolean;
  minutesLeft: number;
  done: boolean;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending || done}
      title={
        asks
          ? "Older than 15 minutes, so the client is asked before anything is deleted"
          : `Made in the last 15 minutes, so it can still be deleted outright (${minutesLeft} min left)`
      }
      className="whitespace-nowrap rounded-control border px-2.5 py-[5px] text-[12px] font-medium transition-colors disabled:opacity-60"
      style={
        asks
          ? { borderColor: "var(--border-strong)", color: "var(--text-secondary)" }
          : {
              borderColor: "var(--danger-action-border)",
              background: "var(--danger-action-bg)",
              color: "var(--danger-action-fg)",
            }
      }
    >
      {pending ? "Working…" : asks ? "Ask to delete" : "Delete"}
    </button>
  );
}
