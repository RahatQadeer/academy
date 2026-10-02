"use client";

import type { InstructorModuleOption } from "../types";

export function ProgramCoverageSelector({
  coverage,
  modules,
  selectedModuleIds,
  disabled,
  onCoverageChange,
  onToggleModule,
}: {
  coverage: "full" | "modules";
  modules: InstructorModuleOption[];
  selectedModuleIds: string[];
  disabled?: boolean;
  onCoverageChange: (coverage: "full" | "modules") => void;
  onToggleModule: (moduleId: string) => void;
}) {
  return (
    <div>
      <span
        className="mb-2 block text-[12.5px] font-medium uppercase tracking-[0.05em]"
        style={{ color: "var(--text-tertiary)" }}
      >
        Coverage
      </span>
      <div className="space-y-2">
        <label className="flex cursor-pointer items-start gap-3 rounded-[8px] px-3 py-2.5 hover:bg-[var(--surface-soft)]">
          <input
            type="radio"
            className="mt-1"
            name="coverage"
            checked={coverage === "full"}
            disabled={disabled}
            onChange={() => onCoverageChange("full")}
          />
          <span>
            <span className="block text-[14px] font-medium">Full program</span>
            <span className="text-[12.5px]" style={{ color: "var(--text-tertiary)" }}>
              Author every module in this program.
            </span>
          </span>
        </label>
        <label className="flex cursor-pointer items-start gap-3 rounded-[8px] px-3 py-2.5 hover:bg-[var(--surface-soft)]">
          <input
            type="radio"
            className="mt-1"
            name="coverage"
            checked={coverage === "modules"}
            disabled={disabled || modules.length === 0}
            onChange={() => onCoverageChange("modules")}
          />
          <span>
            <span className="block text-[14px] font-medium">Selected modules</span>
            <span className="text-[12.5px]" style={{ color: "var(--text-tertiary)" }}>
              {modules.length === 0
                ? "Add modules to this program first."
                : "Limit authoring to the modules you check below."}
            </span>
          </span>
        </label>
      </div>

      {coverage === "modules" && modules.length > 0 ? (
        <ul
          className="mt-3 max-h-[180px] space-y-1 overflow-y-auto rounded-[8px] p-2"
          style={{ border: "1px solid var(--border-strong)" }}
        >
          {modules.map((module, index) => {
            const checked = selectedModuleIds.includes(module.id);
            return (
              <li key={module.id}>
                <label className="flex cursor-pointer items-start gap-2 rounded-[6px] px-2 py-2 hover:bg-[var(--surface-soft)]">
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={checked}
                    disabled={disabled}
                    onChange={() => onToggleModule(module.id)}
                  />
                  <span className="text-[13.5px]">
                    Module {index + 1}
                    {module.title ? ` — ${module.title}` : ""}
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
