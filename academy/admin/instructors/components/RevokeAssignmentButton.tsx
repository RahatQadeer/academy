"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/base/components/Button";
import { revokeInstructorAssignmentAction } from "../actions";

export function RevokeAssignmentButton({ assignmentId }: { assignmentId: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function revoke() {
    startTransition(async () => {
      setError(null);
      const result = await revokeInstructorAssignmentAction(assignmentId);
      if (!result.ok) {
        setError(result.message || "The assignment could not be revoked.");
        return;
      }
      router.refresh();
    });
  }

  return (
    <div>
      <Button variant="secondary" disabled={pending} onClick={revoke}>
        {pending ? "Revoking…" : "Revoke"}
      </Button>
      {error ? (
        <p className="mt-2 text-[12.5px]" style={{ color: "var(--danger-fg)" }}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
