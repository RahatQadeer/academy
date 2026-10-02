import Link from "next/link";
import { InstructorStatus } from "@/academy/instructor/components/InstructorStatus";
import type { EditorProgram } from "../types";
import { SaveDraftBar, type SaveState } from "./SaveDraftBar";

function BackChevron() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M10 3.5L5.5 8 10 12.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ProgramEditorHeader({
  program,
  saveState,
  saveMessage,
  saving,
  locked,
  onSave,
  previewHref,
  moduleCount,
  lessonCount,
}: {
  program: Pick<EditorProgram, "name" | "status" | "latestRequestStatus" | "assignmentScope">;
  saveState: SaveState;
  saveMessage?: string;
  saving: boolean;
  locked: boolean;
  onSave: () => void;
  previewHref: string;
  moduleCount: number;
  lessonCount: number;
}) {
  const scope = program.assignmentScope;
  const modulesLabel = moduleCount === 1 ? "1 module" : `${moduleCount} modules`;
  const lessonsLabel = lessonCount === 1 ? "1 lesson" : `${lessonCount} lessons`;

  return (
    <header className="space-y-4">
      <Link
        href="/academy/instructor/programs"
        className="inline-flex items-center gap-1.5 text-[13px] font-medium no-underline hover:text-accent-hover"
        style={{ color: "var(--text-secondary)" }}
      >
        <BackChevron />
        My Programs
      </Link>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <h1 className="text-[24px] font-bold leading-[1.2] tracking-[-0.4px] text-pretty sm:text-[26px]">
            {program.name.trim() || "Untitled program"}
          </h1>
          <p className="mt-1.5 text-[13px]" style={{ color: "var(--text-secondary)" }}>
            {modulesLabel} · {lessonsLabel}
            {scope && scope.moduleIds.length > 0
              ? ` · Assigned scope: ${scope.scopedModuleTitles.join(", ") || "selected modules"}`
              : ""}
          </p>
        </div>

        <div className="flex shrink-0 flex-col items-start gap-3 sm:items-end">
          <InstructorStatus
            programStatus={program.status}
            publishRequestStatus={program.latestRequestStatus}
          />
          <SaveDraftBar
            state={saving ? "saving" : saveState}
            message={saveMessage}
            disabled={locked}
            onSave={onSave}
            previewHref={previewHref}
          />
        </div>
      </div>
    </header>
  );
}
