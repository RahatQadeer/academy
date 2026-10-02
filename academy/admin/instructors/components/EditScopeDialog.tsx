"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/base/components/Button";
import type { AcademyAssignmentPermission } from "@/academy/lib/domain";
import {
  revokeInstructorAssignmentAction,
  updateInstructorAssignmentAction,
} from "../actions";
import type { InstructorAssignmentItem } from "../types";
import { PermissionSelector } from "./PermissionSelector";
import { ProgramCoverageSelector } from "./ProgramCoverageSelector";
import { PublishPermissionToggle } from "./PublishPermissionToggle";

export function EditScopeDialog({
  assignment,
  onClose,
}: {
  assignment: InstructorAssignmentItem;
  onClose: () => void;
}) {
  const router = useRouter();
  const hasLimitedModules =
    assignment.moduleIds.length > 0 &&
    (assignment.modules.length === 0 || assignment.moduleIds.length < assignment.modules.length);
  const [coverage, setCoverage] = useState<"full" | "modules">(hasLimitedModules ? "modules" : "full");
  const [selectedModuleIds, setSelectedModuleIds] = useState<string[]>(assignment.moduleIds);
  const [permission, setPermission] = useState<AcademyAssignmentPermission>(assignment.permission);
  const [canPublishWithoutApproval, setCanPublishWithoutApproval] = useState(
    assignment.canPublishWithoutApproval,
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function save() {
    startTransition(async () => {
      setError(null);
      if (coverage === "modules" && selectedModuleIds.length === 0) {
        setError("Select at least one module, or choose full program.");
        return;
      }
      const result = await updateInstructorAssignmentAction({
        assignmentId: assignment.id,
        permission,
        moduleIds: coverage === "full" ? [] : selectedModuleIds,
        canPublishWithoutApproval,
      });
      if (!result.ok) {
        setError(result.message || "The assignment could not be updated.");
        return;
      }
      onClose();
      router.refresh();
    });
  }

  function remove() {
    if (
      !window.confirm(
        "Remove this instructor from the program? Their role stays; only this assignment is removed.",
      )
    ) {
      return;
    }
    startTransition(async () => {
      setError(null);
      const result = await revokeInstructorAssignmentAction(assignment.id);
      if (!result.ok) {
        setError(result.message || "The assignment could not be removed.");
        return;
      }
      onClose();
      router.refresh();
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[480px] rounded-[12px] bg-surface p-6 shadow-lg"
        style={{ border: "1px solid var(--border)" }}
        onClick={(event) => event.stopPropagation()}
      >
        <h2 className="text-[18px] font-semibold tracking-[-0.2px]" style={{ color: "var(--ink)" }}>
          Edit scope
        </h2>
        <p className="mt-2 text-[13.5px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
          {assignment.programName}
        </p>
        <p className="mt-1 text-[12.5px] leading-relaxed" style={{ color: "var(--text-tertiary)" }}>
          Choose whether they can author the whole program or only selected modules.
        </p>

        <div className="mt-5 space-y-5">
          <ProgramCoverageSelector
            coverage={coverage}
            modules={assignment.modules}
            selectedModuleIds={selectedModuleIds}
            disabled={pending}
            onCoverageChange={setCoverage}
            onToggleModule={(moduleId) =>
              setSelectedModuleIds((current) =>
                current.includes(moduleId)
                  ? current.filter((id) => id !== moduleId)
                  : [...current, moduleId],
              )
            }
          />
          <PermissionSelector value={permission} disabled={pending} onChange={setPermission} />
          <PublishPermissionToggle
            value={canPublishWithoutApproval}
            disabled={pending}
            onChange={setCanPublishWithoutApproval}
          />
        </div>

        {error ? (
          <p className="mt-3 text-[13px]" style={{ color: "var(--danger-fg)" }}>
            {error}
          </p>
        ) : null}

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            disabled={pending}
            onClick={remove}
            className="text-[13px] font-medium hover:opacity-80 disabled:opacity-50"
            style={{ color: "var(--danger-fg)" }}
          >
            {pending ? "Working…" : "Remove from program"}
          </button>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" disabled={pending} onClick={onClose}>
              Cancel
            </Button>
            <Button variant="primary" disabled={pending} onClick={save}>
              {pending ? "Saving…" : "Save scope"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
