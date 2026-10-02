"use client";

import { SubmitPlain } from "@/base/components/Submit";

import { useEffect, useId, useRef, useState } from "react";
import {
  changeTeammateRole,
  removeTeammate,
  resendTeamInvitation,
} from "@/whitbyos/settings/actions";
import { INVITABLE_ROLES, ROLE_LABELS } from "@/whitbyos/lib/settings-vocab";

/**
 * The ⋯ on a team row.
 *
 * The export draws the control and never what it opens, so this is the smallest
 * honest set: change what they may do, or take them out. Both are gated again
 * on the server — a menu that only appears for Owners and Admins is a courtesy,
 * not a permission.
 *
 * Someone who has not accepted gets a different pair. There is no membership
 * row to write a role to yet, so the invitation itself carries it, and the only
 * way to change it is to issue the invitation again — which is the same press
 * as sending it again, so it is one control rather than two.
 *
 * That control sits on the row itself, not only in the menu. Sending a
 * forgotten invitation again is the ordinary thing to want from a row that says
 * Invited, and the ordinary thing should not be two presses behind a ⋯ nobody
 * has a reason to open. The button resends as they already are; the menu is
 * where it goes to arrive as something else.
 */
export function TeamRowMenu({
  userId,
  email,
  name,
  role,
  pending,
}: {
  userId: string | null;
  email: string;
  name: string;
  role: string;
  /** They have not accepted, so there is a role but nobody holding it yet. */
  pending: boolean;
}) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const roleField = useId();

  useEffect(() => {
    if (!open) return;
    function away(event: MouseEvent) {
      if (!box.current?.contains(event.target as Node)) setOpen(false);
    }
    function escape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("mousedown", away);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);

  return (
    <div ref={box} className="relative flex items-center justify-end gap-2">
      {pending ? (
        <form action={resendTeamInvitation}>
          <input type="hidden" name="email" value={email} />
          {/* As they stand. Changing it on the way out is the menu's job. */}
          <input type="hidden" name="role" value={role} />
          <SubmitPlain
           
            className="rounded-control border border-line-strong px-2.5 py-[5px] text-[12px] font-medium"
            style={{ background: "var(--surface)", color: "var(--ink)" }}
          >
            Resend
          </SubmitPlain>
        </form>
      ) : null}

      <button
        type="button"
        onClick={() => setOpen((was) => !was)}
        aria-label={`Options for ${name}`}
        aria-expanded={open}
        className="px-1 text-[15px] leading-none"
        style={{ color: "var(--text-disabled)" }}
      >
        ⋯
      </button>

      {open ? (
        <div
          className="absolute right-0 top-6 z-20 w-[232px] rounded-[8px] border border-line bg-surface py-1"
          style={{ boxShadow: "0 8px 24px rgba(15,15,15,.14)" }}
        >
          {pending ? (
            <form action={resendTeamInvitation} className="px-3 pb-2 pt-1.5">
              <span
                className="block pb-1.5 text-[10.5px] font-semibold uppercase tracking-[.05em]"
                style={{ color: "var(--text-tertiary)" }}
              >
                Resend invitation
              </span>

              <input type="hidden" name="email" value={email} />

              <label htmlFor={roleField} className="sr-only">
                Role for {name}
              </label>
              <select
                id={roleField}
                name="role"
                defaultValue={role}
                className="mb-2 w-full rounded-control border border-line-strong bg-surface px-2 py-[6px] text-[13px] text-ink"
              >
                {INVITABLE_ROLES.map((option) => (
                  <option key={option} value={option}>
                    {ROLE_LABELS[option]}
                  </option>
                ))}
              </select>

              <SubmitPlain
               
                className="w-full rounded-control px-3 py-[7px] text-[13px] font-medium text-white"
                style={{ background: "var(--accent)" }}
              >
                Send again
              </SubmitPlain>

              <p className="mt-2 text-[11.5px] leading-[1.45]" style={{ color: "var(--text-tertiary)" }}>
                A new link replaces the old one, and the role above is the one
                they arrive with.
              </p>
            </form>
          ) : (
            <>
              <span
                className="block px-3 pb-1 pt-1.5 text-[10.5px] font-semibold uppercase tracking-[.05em]"
                style={{ color: "var(--text-tertiary)" }}
              >
                Change role
              </span>
              {INVITABLE_ROLES.map((option) => (
                <form key={option} action={changeTeammateRole}>
                  <input type="hidden" name="user_id" value={userId ?? ""} />
                  <input type="hidden" name="role" value={option} />
                  <button
                    type="submit"
                    disabled={option === role}
                    className="w-full px-3 py-1.5 text-left text-[13px] hover:bg-[var(--surface-soft)] disabled:opacity-40"
                  >
                    {ROLE_LABELS[option]}
                    {option === role ? " ·  current" : ""}
                  </button>
                </form>
              ))}
            </>
          )}

          <div className="my-1 border-t border-line" />

          <form action={removeTeammate}>
            <input type="hidden" name="user_id" value={userId ?? ""} />
            <input type="hidden" name="email" value={email} />
            <SubmitPlain
             
              className="w-full px-3 py-1.5 text-left text-[13px] hover:bg-[var(--surface-soft)]"
              style={{ color: "var(--danger-text, #b3261e)" }}
            >
              {pending ? "Withdraw invitation" : "Remove from workspace"}
            </SubmitPlain>
          </form>
        </div>
      ) : null}
    </div>
  );
}
