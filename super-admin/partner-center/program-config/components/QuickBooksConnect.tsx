"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/base/components/Button";
import { AdminDetailSection } from "@/super-admin/partner-center/components/AdminDetailSections";
import type { QbCredentialPublicStatus } from "@/partner-center/lib/quickbooks/credentials";
import { disconnectQuickBooksAction } from "@/super-admin/partner-center/actions";

function statusLabel(status: QbCredentialPublicStatus["status"]): string {
  if (status === "connected") return "Connected";
  if (status === "needs_attention") return "Needs attention";
  return "Disconnected";
}

export function QuickBooksConnect({
  status,
  connectedMessage,
  errorMessage,
}: {
  status: QbCredentialPublicStatus;
  connectedMessage?: string | null;
  errorMessage?: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [localError, setLocalError] = useState<string | null>(null);
  const [localMessage, setLocalMessage] = useState<string | null>(null);

  const canDisconnect =
    status.status === "connected" || status.status === "needs_attention";

  return (
    <AdminDetailSection title="QuickBooks Online" variant="form">
      <p className="mb-4 text-[13px]" style={{ color: "var(--text-secondary)" }}>
        Match non-Stripe enterprise payments from QuickBooks.
      </p>

      {!status.configured ? (
        <p className="mb-4 text-[13px]" style={{ color: "var(--text-secondary)" }}>
          Add Intuit client ID, secret, and webhook token to enable OAuth.
        </p>
      ) : null}

      <dl className="mb-4 grid gap-2 text-[13px] sm:grid-cols-2">
        <div>
          <dt style={{ color: "var(--text-tertiary)" }}>Status</dt>
          <dd className="font-medium">{statusLabel(status.status)}</dd>
        </div>
        <div>
          <dt style={{ color: "var(--text-tertiary)" }}>Account</dt>
          <dd>{status.connectedAccount || "—"}</dd>
        </div>
        <div>
          <dt style={{ color: "var(--text-tertiary)" }}>Realm</dt>
          <dd className="font-mono text-[12.5px]">{status.realmId || "—"}</dd>
        </div>
        <div>
          <dt style={{ color: "var(--text-tertiary)" }}>Last sync</dt>
          <dd>
            {status.lastSyncAt
              ? new Date(status.lastSyncAt).toLocaleString()
              : "—"}
          </dd>
        </div>
        <div className="sm:col-span-2">
          <dt style={{ color: "var(--text-tertiary)" }}>Scopes</dt>
          <dd className="break-all font-mono text-[12.5px]">
            {status.scopes || "—"}
          </dd>
        </div>
      </dl>

      {status.errorState ? (
        <p className="mb-4 text-[13px]" style={{ color: "#a8433b" }}>
          {status.errorState}
        </p>
      ) : null}
      {errorMessage || localError ? (
        <p className="mb-4 text-[13px]" style={{ color: "#a8433b" }}>
          {localError || errorMessage}
        </p>
      ) : null}
      {connectedMessage || localMessage ? (
        <p className="mb-4 text-[13px]" style={{ color: "var(--text-secondary)" }}>
          {localMessage || connectedMessage}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="primary"
          disabled={!status.configured}
          href={
            status.configured
              ? "/api/super-admin/quickbooks/start"
              : undefined
          }
        >
          {status.status === "connected"
            ? "Reconnect QuickBooks"
            : "Connect QuickBooks"}
        </Button>
        {canDisconnect ? (
          <Button
            type="button"
            variant="secondary"
            disabled={pending}
            onClick={() => {
              setLocalError(null);
              setLocalMessage(null);
              startTransition(async () => {
                const result = await disconnectQuickBooksAction();
                if (result.error) {
                  setLocalError(result.error);
                  return;
                }
                setLocalMessage(result.message ?? "Disconnected.");
                router.refresh();
              });
            }}
          >
            {pending ? "Disconnecting…" : "Disconnect"}
          </Button>
        ) : null}
      </div>
    </AdminDetailSection>
  );
}
