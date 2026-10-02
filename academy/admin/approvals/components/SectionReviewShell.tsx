"use client";

import { useState } from "react";
import type { ApprovalSectionReviewDetail } from "../../types";
import { ApprovalStageStatus } from "./ApprovalStageStatus";
import { SectionReviewContent } from "./SectionReviewContent";
import { SectionReviewSidebar } from "./SectionReviewSidebar";
import { SectionReviewToolbar } from "./SectionReviewToolbar";

const CHECKLIST_IDS = ["accurate", "tone", "confidential"] as const;

export function SectionReviewShell({ detail }: { detail: ApprovalSectionReviewDetail }) {
  const [checks, setChecks] = useState<Record<string, boolean>>({
    accurate: false,
    tone: false,
    confidential: false,
  });
  const allChecked = CHECKLIST_IDS.every((id) => checks[id]);

  return (
    <>
      <header className="mt-5 flex flex-col gap-4 border-b pb-5 lg:flex-row lg:items-end lg:justify-between" style={{ borderColor: "var(--border)" }}>
        <div className="min-w-0">
          <p
            className="text-[12px] font-medium"
            style={{ color: "var(--text-tertiary)" }}
          >
            {detail.contentHeader}
          </p>
          <div className="mt-1.5 flex flex-wrap items-center gap-2.5">
            <h1 className="text-[22px] font-semibold leading-snug tracking-[-0.03em] text-pretty sm:text-[24px]">
              {detail.lesson.title}
            </h1>
            <ApprovalStageStatus
              stage={
                detail.status === "rejected"
                  ? "returned"
                  : detail.status === "approved"
                    ? "ready"
                    : "pending"
              }
            />
          </div>
          <p className="mt-1.5 text-[13px]" style={{ color: "var(--text-secondary)" }}>
            Module {detail.module.index}.{detail.lesson.index} · {detail.module.title}
          </p>
        </div>
        <SectionReviewToolbar detail={detail} allChecked={allChecked} />
      </header>

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_280px] lg:items-start">
        <SectionReviewContent detail={detail} />
        <SectionReviewSidebar
          detail={detail}
          checks={checks}
          onToggle={(id, value) => setChecks((current) => ({ ...current, [id]: value }))}
        />
      </div>
    </>
  );
}
