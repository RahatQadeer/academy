"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/base/components/Button";
import type { AcademyAssignmentPermission } from "@/academy/lib/domain";
import { programStatusLabel } from "@/academy/instructor/utils/labels";
import { assignInstructorAction, loadProgramModulesAction } from "../actions";
import type { AssignableProgram, InstructorModuleOption } from "../types";
import { FilterSelect } from "@/academy/components/ui/FilterSelect";
import { AssignmentEmptyState } from "./AssignmentEmptyState";
import { PermissionSelector } from "./PermissionSelector";
import { ProgramCoverageSelector } from "./ProgramCoverageSelector";
import { PublishPermissionToggle } from "./PublishPermissionToggle";

export function AssignInstructorForm({
  userId,
  programs,
  emptyKind = "all_assigned",
}: {
  userId: string;
  programs: AssignableProgram[];
  emptyKind?: "programs" | "all_assigned";
}) {
  const router = useRouter();
  const [programId, setProgramId] = useState(programs[0]?.id ?? "");
  const [permission, setPermission] = useState<AcademyAssignmentPermission>("edit");
  const [canPublishWithoutApproval, setCanPublishWithoutApproval] = useState(false);
  const [coverage, setCoverage] = useState<"full" | "modules">("full");
  const [modules, setModules] = useState<InstructorModuleOption[]>([]);
  const [selectedModuleIds, setSelectedModuleIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!programId) {
      setModules([]);
      return;
    }
    let cancelled = false;
    void loadProgramModulesAction(programId).then((result) => {
      if (cancelled) return;
      setModules(result.ok ? result.modules : []);
      setSelectedModuleIds([]);
      setCoverage("full");
    });
    return () => {
      cancelled = true;
    };
  }, [programId]);

  if (programs.length === 0) {
    return <AssignmentEmptyState kind={emptyKind} />;
  }

  function assign() {
    startTransition(async () => {
      setError(null);
      setMessage(null);
      if (coverage === "modules" && selectedModuleIds.length === 0) {
        setError("Select at least one module, or choose full program.");
        return;
      }
      const result = await assignInstructorAction({
        userId,
        programId,
        permission,
        moduleIds: coverage === "full" ? [] : selectedModuleIds,
        canPublishWithoutApproval,
      });
      if (!result.ok) {
        setError(result.message || "The assignment could not be created.");
        return;
      }
      setMessage("Assigned");
      router.refresh();
    });
  }

  return (
    <section
      className="rounded-[12px] bg-surface p-5 sm:p-6"
      style={{
        border: "1px solid var(--border)",
        boxShadow: "0 1px 2px rgba(15,15,15,.04), 0 8px 24px rgba(15,15,15,.035)",
      }}
    >
      <h2 className="text-[16px] font-semibold tracking-[-0.2px]">Assign to a program</h2>
      <p className="mt-1 text-[13px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
        Default is full program access. You can limit that to specific modules if needed.
      </p>
      <div className="mt-4 space-y-5">
        <FilterSelect
          tone="field"
          size="md"
          label="Program"
          value={programId}
          disabled={pending}
          onChange={setProgramId}
          options={programs.map((program) => ({
            value: program.id,
            label: `${program.name} (${programStatusLabel(program.status)})`,
          }))}
        />
        <ProgramCoverageSelector
          coverage={coverage}
          modules={modules}
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
      {message ? (
        <p className="mt-3 text-[13px]" style={{ color: "var(--success-fg)" }}>
          {message}
        </p>
      ) : null}
      <div className="mt-4">
        <Button variant="primary" disabled={pending || !programId} onClick={assign}>
          {pending ? "Assigning…" : "Assign"}
        </Button>
      </div>
    </section>
  );
}
