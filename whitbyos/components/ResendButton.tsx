"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { resendPortalInvitation, type ResendResult } from "@/whitbyos/clients/actions";

/**
 * "Send invitation" and "Resend", with the whole round trip visible.
 *
 * Sending goes out to Supabase and back. A plain submit gave nothing back
 * meanwhile, so it read as a button that had not worked and got pressed again
 * — sending a second invitation and quietly invalidating the link in the first.
 *
 * The result is shown here rather than raised as a toast. The action used to
 * redirect to the page it was already on, which does not move the router, so
 * the toast never appeared at all while the email went every time. A button
 * that reports its own outcome needs no navigation to be believed.
 */
export function ResendForm({
  clientId,
  contactId,
  email,
  name,
  label,
  variant = "link",
}: {
  clientId: string;
  contactId: string | null;
  email: string;
  name: string;
  label: string;
  /**
   * "link" on the client's Contacts tab, "quiet" where it sits inside a
   * sentence, and "button" in a list row's action lane — where it is one of
   * two things done to the row and has to look like one.
   */
  variant?: "link" | "quiet" | "button";
}) {
  const [result, action] = useActionState<ResendResult, FormData>(
    resendPortalInvitation,
    null,
  );

  return (
    <form action={action} className="inline-flex items-center gap-2">
      <input type="hidden" name="client_id" value={clientId} />
      {contactId ? <input type="hidden" name="contact_id" value={contactId} /> : null}
      <input type="hidden" name="email" value={email} />
      <input type="hidden" name="name" value={name} />

      <Button label={label} variant={variant} done={result} />

      {result ? (
        <span
          role="status"
          className="whitespace-nowrap text-[11px]"
          style={{ color: result.ok ? "var(--success-fg)" : "var(--danger-text)" }}
          title={result.message}
        >
          {result.ok ? "Sent" : "Not sent"}
        </span>
      ) : null}
    </form>
  );
}

/** The bordered look, matching `base/components/Button`'s secondary. */
const BUTTON =
  "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-control border border-line-strong bg-transparent px-3 py-1.5 text-[12.5px] font-medium transition-colors hover:bg-surface-soft disabled:opacity-40";

function Button({
  label,
  variant,
  done,
}: {
  label: string;
  variant: "link" | "quiet" | "button";
  done: ResendResult;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      title={done?.message ?? `Send the invitation to this person again`}
      className={
        variant === "link"
          ? "inline-flex items-center gap-1.5 whitespace-nowrap text-[11.5px] font-medium underline disabled:no-underline disabled:opacity-70"
          : variant === "button"
            ? BUTTON
            : "inline-flex items-center gap-1.5 whitespace-nowrap text-[12px] font-medium disabled:opacity-70"
      }
      // A bordered button carries its own edge, so the word inside it is ink
      // rather than the accent a bare link needs to read as pressable.
      style={{
        color: pending
          ? "var(--text-tertiary)"
          : variant === "button"
            ? "var(--ink)"
            : "var(--accent)",
      }}
    >
      {pending ? (
        <>
          <Spinner />
          Sending…
        </>
      ) : done ? (
        "Send again"
      ) : (
        label
      )}
    </button>
  );
}

function Spinner() {
  return (
    <span
      aria-hidden
      className="inline-block h-[11px] w-[11px] shrink-0 animate-spin rounded-full border-[1.5px] border-solid"
      style={{ borderColor: "var(--border-strong)", borderTopColor: "var(--text-tertiary)" }}
    />
  );
}
