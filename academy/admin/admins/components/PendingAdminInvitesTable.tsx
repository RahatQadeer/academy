"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Avatar } from "@/base/components/Avatar";
import { Pill } from "@/base/components/Pill";
import { resendAdminInviteAction } from "../actions";
import { adminInviteExpiryLabel } from "../lib/inviteExpiry";
import type { PendingAdminInvite } from "../types";

const CARD_SHADOW = "0 1px 2px rgba(15,15,15,.04), 0 8px 24px rgba(15,15,15,.035)";

export function PendingAdminInvitesTable({ invites }: { invites: PendingAdminInvite[] }) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sending, startTransition] = useTransition();

  function resend(invite: PendingAdminInvite) {
    startTransition(async () => {
      setPendingId(invite.id);
      setError(null);
      setMessage(null);
      const result = await resendAdminInviteAction({
        email: invite.email,
        displayName: invite.displayName,
      });
      setPendingId(null);
      if (!result.ok) {
        setError(result.message || "The invite could not be resent.");
        return;
      }
      setMessage(`A new 24-hour invite was sent to ${invite.email}.`);
      router.refresh();
    });
  }

  return (
    <section>
      <div
        className="overflow-hidden rounded-[12px] bg-surface"
        style={{ border: "1px solid var(--border)", boxShadow: CARD_SHADOW }}
      >
        <div
          className="flex items-end justify-between gap-3 border-b px-5 py-4 sm:px-6"
          style={{ borderColor: "var(--border)" }}
        >
          <div>
            <h2 className="text-[16px] font-semibold tracking-[-0.2px]">Pending invites</h2>
            <p className="mt-1 text-[13px]" style={{ color: "var(--text-secondary)" }}>
              These people have not opened the email or created an account yet. The link lasts 24
              hours.
            </p>
          </div>
          <p className="text-[12.5px] font-medium tabular-nums" style={{ color: "var(--text-tertiary)" }}>
            {invites.length.toLocaleString()}
          </p>
        </div>

        <ul className="m-0 list-none p-0">
          {invites.map((invite, index) => {
            const busy = sending && pendingId === invite.id;
            return (
              <li
                key={invite.id}
                className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6"
                style={index > 0 ? { borderTop: "1px solid var(--border)" } : undefined}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar name={invite.displayName} size={36} tone="tan" />
                  <div className="min-w-0">
                    <p className="truncate text-[13.5px] font-medium">{invite.displayName}</p>
                    <p className="truncate text-[12px]" style={{ color: "var(--text-tertiary)" }}>
                      {invite.email}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2.5 sm:justify-end">
                  <Pill tone={invite.expired ? "warning" : "info"}>
                    {invite.expired ? "Expired" : adminInviteExpiryLabel(invite.expiresAt)}
                  </Pill>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => resend(invite)}
                    className="cursor-pointer rounded-[8px] border-none bg-transparent px-2.5 py-1.5 text-[13px] font-medium text-accent hover:bg-[color:var(--accent-tint)] hover:text-accent-hover disabled:opacity-50"
                  >
                    {busy ? "Sending…" : invite.expired ? "Send new link" : "Resend invite"}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
      {error ? (
        <p className="mt-2 text-[12.5px]" style={{ color: "var(--danger-fg)" }}>
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="mt-2 text-[12.5px]" style={{ color: "var(--success-fg)" }}>
          {message}
        </p>
      ) : null}
    </section>
  );
}
