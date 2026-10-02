"use client";

import { useTransition } from "react";
import { Button } from "@/base/components/Button";
import { Pill } from "@/base/components/Pill";
import { approveAppliedWorkSubmissionAction } from "../actions";

export function ReviewSubmissionsPanel({
  credentialId,
  submissions,
}: {
  credentialId: string;
  submissions: {
    id: string;
    summary: string;
    status: string;
    submittedAt: string;
  }[];
}) {
  const [pending, startTransition] = useTransition();

  if (submissions.length === 0) return null;

  function approve(submissionId: string) {
    startTransition(async () => {
      await approveAppliedWorkSubmissionAction(credentialId, submissionId);
    });
  }

  return (
    <section
      className="overflow-hidden rounded-[12px] bg-white"
      style={{ border: "1px solid var(--border)" }}
    >
      <div
        className="flex flex-wrap items-center justify-between gap-2 border-b px-5 py-4 sm:px-6"
        style={{ borderColor: "var(--border)", background: "var(--surface-subtle)" }}
      >
        <div>
          <h3
            className="text-[15px] font-semibold tracking-[-0.2px]"
            style={{ color: "var(--ink)" }}
          >
            Applied work submissions
          </h3>
          <p className="mt-0.5 text-[13px]" style={{ color: "var(--text-secondary)" }}>
            {submissions.length} {submissions.length === 1 ? "submission" : "submissions"} to review
          </p>
        </div>
      </div>

      <ul className="divide-y" style={{ borderColor: "var(--border)" }}>
        {submissions.map((item) => {
          const approved = item.status === "approved";
          return (
            <li key={item.id} className="px-5 py-4 sm:px-6" style={{ borderColor: "var(--border)" }}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <Pill tone={approved ? "success" : "warning"}>
                  {approved ? "Approved" : "Awaiting review"}
                </Pill>
                {!approved ? (
                  <Button
                    type="button"
                    variant="primary"
                    disabled={pending}
                    onClick={() => approve(item.id)}
                  >
                    Approve
                  </Button>
                ) : null}
              </div>
              <p
                className="mt-3 whitespace-pre-wrap text-[13.5px] leading-relaxed"
                style={{ color: "var(--ink)" }}
              >
                {item.summary}
              </p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
