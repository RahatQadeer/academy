"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/base/components/Button";
import { grantAcademyAdminAction, revokeAcademyAdminAction } from "../actions";

function RevokeIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden>
      <circle cx="6.5" cy="6.5" r="4.75" stroke="currentColor" strokeWidth="1.25" />
      <path d="M4.1 4.1l4.8 4.8" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
    </svg>
  );
}

function RestoreIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden>
      <path
        d="M3.2 6.5a3.3 3.3 0 1 1 .7 2.05"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
      />
      <path
        d="M3.2 3.8v2.8h2.8"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function AdminRoleButton({
  userId,
  action,
  onComplete,
  appearance = "default",
}: {
  userId: string;
  action: "grant" | "reactivate" | "revoke";
  onComplete?: () => void;
  /** Compact chip for table rows. */
  appearance?: "default" | "row";
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const label =
    action === "revoke" ? "Revoke" : action === "reactivate" ? "Restore" : "Grant Admin";
  const pendingLabel =
    action === "revoke" ? "Revoking…" : action === "reactivate" ? "Restoring…" : "Granting…";
  const fullLabel =
    action === "revoke" ? "Revoke Admin" : action === "reactivate" ? "Restore Admin" : "Grant Admin";

  function run() {
    if (action === "revoke") {
      if (!window.confirm("Revoke Admin access? This person will lose Admin permissions.")) {
        return;
      }
    }
    startTransition(async () => {
      setError(null);
      setMessage(null);
      if (action === "revoke") {
        const result = await revokeAcademyAdminAction(userId);
        if (!result.ok) {
          setError(result.message || "The Admin role could not be revoked.");
          return;
        }
        setMessage("Suspended");
        router.refresh();
        onComplete?.();
        return;
      }
      const result = await grantAcademyAdminAction(userId);
      if (!result.ok) {
        setError(result.message || "The Admin role could not be granted.");
        return;
      }
      if (result.outcome === "already_admin") setMessage("Already an Admin");
      else if (result.outcome === "reactivated") setMessage("Admin restored");
      else setMessage("Admin granted");
      router.refresh();
      onComplete?.();
    });
  }

  if (appearance === "row") {
    const isRevoke = action === "revoke";
    return (
      <div className="inline-flex flex-col items-end gap-1">
        <button
          type="button"
          disabled={pending}
          onClick={run}
          aria-label={fullLabel}
          className="inline-flex items-center gap-1.5 rounded-[8px] border-none px-2.5 py-1.5 text-[12.5px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-45"
          style={{
            cursor: pending ? "wait" : "pointer",
            color: isRevoke ? "var(--danger-fg)" : "var(--success-fg)",
            background: isRevoke ? "var(--danger-bg)" : "var(--success-bg)",
          }}
        >
          {isRevoke ? <RevokeIcon /> : <RestoreIcon />}
          {pending ? pendingLabel : label}
        </button>
        {error ? (
          <p className="max-w-[160px] text-right text-[11.5px] leading-snug" style={{ color: "var(--danger-fg)" }}>
            {error}
          </p>
        ) : null}
        {message ? (
          <p className="text-[11.5px]" style={{ color: "var(--success-fg)" }}>
            {message}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div>
      <Button
        variant={action === "revoke" ? "secondary" : "primary"}
        disabled={pending}
        onClick={run}
        style={action === "revoke" ? { color: "var(--danger-fg)" } : undefined}
      >
        {pending ? pendingLabel : fullLabel}
      </Button>
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
    </div>
  );
}
