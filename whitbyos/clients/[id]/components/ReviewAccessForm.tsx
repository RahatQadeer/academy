"use client";

import Link from "next/link";
import { useActionState, useEffect } from "react";
import { Spinner } from "@/base/components/Submit";
import { approveAccessRequest, declineAccessRequest } from "@/whitbyos/clients/actions";
import type { DialogResult } from "@/whitbyos/components/DialogForm";

/**
 * The two answers 2.1.2.1 offers, from one footer.
 *
 * Not `DialogForm`, because this dialog has two actions rather than one and a
 * form cannot be nested. Decline is its own form alongside the approval, and
 * the button reaches it by `form=`, which is what that attribute is for. Both
 * follow `DialogForm`'s rule: the action returns where to go and the move is a
 * real navigation, because redirecting to the route the dialog is already on
 * does not move the router and the answer would look like nothing happening.
 */
export function ReviewAccessForm({
  requestId,
  clientId,
  closeHref,
  children,
}: {
  requestId: string;
  clientId: string;
  closeHref: string;
  children: React.ReactNode;
}) {
  const [approval, approve, approving] = useActionState(approveAccessRequest, null);
  const [refusal, decline, declining] = useActionState(declineAccessRequest, null);

  const done: DialogResult = approval?.ok ? approval : refusal?.ok ? refusal : null;
  useEffect(() => {
    if (done?.ok) window.location.assign(done.to);
  }, [done]);

  const failed = (approval && !approval.ok && approval.error) ||
    (refusal && !refusal.ok && refusal.error) ||
    null;

  const declineForm = `decline-${requestId}`;

  return (
    <>
      {/* Empty, and first, so it is never inside the approval form. */}
      <form id={declineForm} action={decline}>
        <input type="hidden" name="request_id" value={requestId} />
        <input type="hidden" name="client_id" value={clientId} />
      </form>

      <form action={approve} className="flex flex-col gap-[18px]">
        <input type="hidden" name="request_id" value={requestId} />
        <input type="hidden" name="client_id" value={clientId} />

        {children}

        {failed ? (
          <p className="text-[12.5px]" style={{ color: "var(--danger-text)" }}>
            {failed}
          </p>
        ) : null}

        <div className="flex items-center justify-between gap-3">
          {/* Its own pending flag rather than `SubmitPlain`: that reads the
              form it sits inside, and this button posts to the other one. */}
          <button
            type="submit"
            form={declineForm}
            formNoValidate
            disabled={approving || declining}
            className="flex items-center gap-1.5 px-1 py-[9px] text-[13.5px] font-medium disabled:opacity-60"
            style={{ color: "var(--danger-text, #b3261e)" }}
          >
            {declining ? <Spinner /> : null}
            {declining ? "Declining…" : "Decline request"}
          </button>

          <div className="flex gap-2.5">
            <Link
              href={closeHref}
              className="rounded-control border border-line-strong px-4 py-[9px] text-[13.5px] font-medium no-underline"
              style={{ color: "var(--ink)" }}
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={approving || declining}
              className="flex items-center gap-1.5 rounded-control px-4 py-[9px] text-[13.5px] font-medium text-white disabled:opacity-60"
              style={{ background: "var(--accent)" }}
            >
              {approving ? <Spinner /> : null}
              {approving ? "Approving…" : "Approve & send invitation"}
            </button>
          </div>
        </div>
      </form>
    </>
  );
}
