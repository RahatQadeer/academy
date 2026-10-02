"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { enrollInFreeProgramAction } from "@/academy/enrollment/actions";
import { freeEnrollmentMessage } from "@/academy/enrollment/utils/messages";
import { lessonPlayerHref } from "@/academy/lesson-player/utils/curriculum";

export function StartFreeEnrollmentButton({
  programId,
  fullWidth,
}: {
  programId: string;
  fullWidth?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const className = fullWidth
    ? "inline-flex w-full items-center justify-center rounded-[6px] px-4 py-2 text-[13.5px]"
    : "inline-flex w-full items-center justify-center rounded-[6px] px-3 py-[7px] text-[13px]";

  return (
    <div>
      <button
        type="button"
        disabled={pending}
        className={className}
        style={{
          background: "var(--accent)",
          color: "#fff",
          opacity: pending ? 0.55 : 1,
          cursor: pending ? "not-allowed" : "pointer",
          border: 0,
        }}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            const result = await enrollInFreeProgramAction(programId);
            if (result.status === "enrolled" || result.status === "already_enrolled") {
              router.push(lessonPlayerHref(programId));
              router.refresh();
              return;
            }
            setError(freeEnrollmentMessage(result.reason));
          });
        }}
      >
        {pending ? "Starting…" : "Start"}
      </button>
      {error ? (
        <p className="mt-2 text-[12.5px] leading-relaxed" style={{ color: "var(--warning-fg)" }}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
