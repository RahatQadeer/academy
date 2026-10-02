"use client";

import { SubmitPlain } from "@/base/components/Submit";

import { useActionState, useEffect } from "react";
import Link from "next/link";

/**
 * A form inside a dialog that has to move the page when it succeeds.
 *
 * A server action that redirects to the route it was called from does not
 * move the router: the row is written, the action returns, and the URL still
 * carries `?new=…`, so the dialog stays open over a screen that has quietly
 * changed underneath it. Screen 1's New Request modal had been failing this
 * way since it was built, which is why 1.2.1's toast had never appeared.
 *
 * Two things had to change. The action returns where to go rather than going
 * there, and it no longer calls `revalidatePath` on the way out: revalidating
 * the page the dialog is on remounts the dialog, which threw away the result
 * before anything could read it.
 *
 * The move itself is a real navigation rather than `router.replace`, because
 * the App Router will not change the URL for a replace onto the route it is
 * already on, which is the whole situation here. Sign-in does the same.
 *
 * The footer belongs to this component rather than to each caller: the pending
 * flag and the failure both live in state here, and a render prop cannot cross
 * the boundary from a server component.
 */
export type DialogResult =
  | { ok: true; to: string }
  | { ok: false; error: string }
  | null;

export function DialogForm({
  action,
  closeHref,
  submitLabel,
  pendingLabel = "Saving…",
  className = "flex flex-col gap-4",
  footerStart,
  cancel = true,
  ruled = false,
  children,
}: {
  action: (previous: DialogResult, formData: FormData) => Promise<DialogResult>;
  closeHref: string;
  submitLabel: string;
  pendingLabel?: string;
  className?: string;
  /** Put on the left of the footer, where 16.2 draws Disconnect. */
  footerStart?: React.ReactNode;
  /** 16.2 has no Cancel: Disconnect and Save are the two answers. */
  cancel?: boolean;
  /** 16.2 rules its footer off from the switches above it. */
  ruled?: boolean;
  children: React.ReactNode;
}) {
  const [state, formAction, pending] = useActionState(action, null);

  useEffect(() => {
    if (state?.ok) window.location.assign(state.to);
  }, [state]);

  return (
    <form action={formAction} className={className}>
      {children}

      {state && !state.ok ? (
        <p className="text-[12.5px]" style={{ color: "var(--danger-text)" }}>
          {state.error}
        </p>
      ) : null}

      <div
        className={
          ruled
            ? "mt-1 flex items-center justify-between gap-3 border-t border-line pt-4"
            : "mt-1 flex items-center justify-end gap-2.5"
        }
      >
        {footerStart ?? null}

        <div className="flex items-center gap-2.5">
        {cancel ? (
          <Link
            href={closeHref}
            className="rounded-control border border-line-strong px-4 py-[9px] text-[13.5px] font-medium no-underline"
            style={{ color: "var(--ink)" }}
          >
            Cancel
          </Link>
        ) : null}
        <SubmitPlain
         
          disabled={pending}
          className="rounded-control px-[18px] py-[9px] text-[13.5px] font-medium text-white disabled:opacity-60"
          style={{ background: "var(--accent)" }}
        >
          {pending ? pendingLabel : submitLabel}
        </SubmitPlain>
        </div>
      </div>
    </form>
  );
}
