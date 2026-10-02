"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/base/components/Button";
import { grantInstructorRoleAction, revokeInstructorRoleAction } from "../actions";

export function InstructorRoleButton({
  userId,
  action,
  onComplete,
}: {
  userId: string;
  action: "grant" | "reactivate" | "revoke";
  onComplete?: () => void;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const label =
    action === "revoke" ? "Revoke Instructor" : action === "reactivate" ? "Reactivate Instructor" : "Grant Instructor";
  const pendingLabel =
    action === "revoke" ? "Revoking…" : action === "reactivate" ? "Reactivating…" : "Granting…";

  function run() {
    startTransition(async () => {
      setError(null);
      setMessage(null);
      if (action === "revoke") {
        const result = await revokeInstructorRoleAction(userId);
        if (!result.ok) {
          setError(result.message || "The Instructor role could not be revoked.");
          return;
        }
        setMessage("Suspended");
        router.refresh();
        onComplete?.();
        return;
      }
      const result = await grantInstructorRoleAction(userId);
      if (!result.ok) {
        setError(result.message || "The Instructor role could not be granted.");
        return;
      }
      if (result.outcome === "already_instructor") setMessage("Already an Instructor");
      else if (result.outcome === "reactivated") setMessage("Instructor reactivated");
      else setMessage("Instructor granted");
      router.refresh();
      onComplete?.();
    });
  }

  return (
    <div>
      <Button variant={action === "revoke" ? "secondary" : "primary"} disabled={pending} onClick={run}>
        {pending ? pendingLabel : label}
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
