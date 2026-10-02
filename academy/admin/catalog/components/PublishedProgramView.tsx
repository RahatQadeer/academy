"use client";

import { useState } from "react";
import Link from "next/link";
import { Pill } from "@/base/components/Pill";
import { Button } from "@/base/components/Button";
import { Callout } from "@/base/components/Callout";
import type { TreeModule } from "./ModuleTree";

export type PublishedProgram = {
  id: string;
  name: string;
  modules: (TreeModule & { edited?: boolean })[];
  enrollmentCount: number;
  avgCompletion: number;
  firstPublished: string;
  pendingChanges: number;
};

export function PublishedProgramView({ program }: { program: PublishedProgram }) {
  const [activeModuleId, setActiveModuleId] = useState(program.modules[0]?.id ?? "");
  const activeModule = program.modules.find((m) => m.id === activeModuleId);

  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      {/* Top bar */}
      <div
        className="sticky top-0 z-20 flex items-center justify-between border-b px-4 py-2.5"
        style={{ background: "var(--surface)", borderColor: "var(--border)" }}
      >
        <div className="flex items-center gap-3">
          <Link
            href="/academy/admin/programs"
            className="text-[13px] font-medium no-underline"
            style={{ color: "var(--text-tertiary)" }}
          >
            ← Programs
          </Link>
          <span className="text-[14px] font-semibold" style={{ color: "var(--ink)" }}>
            {program.name}
          </span>
          <Pill tone="success">Published</Pill>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" className="!py-1.5 !text-[13px]">
            Preview
          </Button>
          <Button variant="secondary" className="!py-1.5 !text-[13px]">
            Unpublish
          </Button>
          {program.pendingChanges > 0 ? (
            <Button variant="primary" className="!py-1.5 !text-[13px]">
              Publish {program.pendingChanges} changes
            </Button>
          ) : null}
        </div>
      </div>

      {program.pendingChanges > 0 ? (
        <div className="px-6 pt-4">
          <Callout tone="warning" title="Unpublished edits">
            {program.enrollmentCount.toLocaleString()} learners are enrolled in the live version.
            Your edits stay unpublished until you press Publish changes — in-progress learners keep
            the version they started.
          </Callout>
        </div>
      ) : null}

      <div className="flex flex-1 px-6 py-6">
        {/* Module sidebar */}
        <div className="w-[200px] shrink-0">
          <p
            className="pb-2 text-[11px] font-semibold tracking-[.06em] uppercase"
            style={{ color: "var(--text-tertiary)" }}
          >
            Modules
          </p>
          {program.modules.map((mod, i) => (
            <button
              key={mod.id}
              type="button"
              onClick={() => setActiveModuleId(mod.id)}
              className="flex w-full items-center gap-1 rounded-[6px] px-3 py-1.5 text-left text-[13px]"
              style={{
                color: "var(--ink)",
                fontWeight: activeModuleId === mod.id ? 600 : 400,
                background:
                  activeModuleId === mod.id
                    ? "var(--accent-tint-soft, #e7f1fb)"
                    : "transparent",
                border:
                  activeModuleId === mod.id
                    ? "1px solid var(--accent)"
                    : "1px solid transparent",
                borderRadius: 6,
              }}
            >
              {i + 1}. {mod.title}
              {mod.edited ? (
                <span className="ml-auto text-[10px]" style={{ color: "var(--text-tertiary)" }}>
                  edited
                </span>
              ) : null}
            </button>
          ))}
        </div>

        {/* Content area */}
        <div className="min-w-0 flex-1 pl-8">
          {/* Stats row */}
          <div className="flex gap-8">
            <div>
              <div className="text-[24px] font-bold tracking-[-0.3px]" style={{ color: "var(--ink)" }}>
                {program.enrollmentCount.toLocaleString()}
              </div>
              <p className="text-[12px]" style={{ color: "var(--text-tertiary)" }}>
                Enrolled
              </p>
            </div>
            <div>
              <div className="text-[24px] font-bold tracking-[-0.3px]" style={{ color: "var(--ink)" }}>
                {program.avgCompletion}%
              </div>
              <p className="text-[12px]" style={{ color: "var(--text-tertiary)" }}>
                Avg. Completion
              </p>
            </div>
            <div>
              <div className="text-[24px] font-bold tracking-[-0.3px]" style={{ color: "var(--ink)" }}>
                {program.firstPublished}
              </div>
              <p className="text-[12px]" style={{ color: "var(--text-tertiary)" }}>
                First published
              </p>
            </div>
          </div>

          {/* Module title + lessons */}
          {activeModule ? (
            <div className="mt-8">
              <label className="block text-[12px] font-medium" style={{ color: "var(--text-tertiary)" }}>
                Module title
              </label>
              <input
                type="text"
                defaultValue={activeModule.title}
                className="mt-1 w-full border-b pb-2 text-[16px] font-medium outline-none"
                style={{
                  color: "var(--ink)",
                  borderColor: "var(--border)",
                  background: "transparent",
                }}
              />

              <p
                className="mt-6 text-[12px] font-medium"
                style={{ color: "var(--text-tertiary)" }}
              >
                Lessons
              </p>
              <div className="mt-2 flex flex-col gap-1">
                {activeModule.lessons.map((les) => (
                  <div
                    key={les.id}
                    className="rounded-[6px] border px-4 py-2.5 text-[14px]"
                    style={{ borderColor: "var(--border)", color: "var(--ink)", background: "var(--surface)" }}
                  >
                    {les.title}
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
