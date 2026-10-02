"use client";

import { useState } from "react";
import Link from "next/link";
import { Pill } from "@/base/components/Pill";
import { Button } from "@/base/components/Button";
import { refineCatalogProgramAction } from "@/academy/admin/actions";
import { WhitbyChat, type WhitbyMessage } from "./WhitbyChat";

type Module = {
  title: string;
  lessonCount: number;
  isNew?: boolean;
  isUpdated?: boolean;
};

export function WhitbyDraftView({
  programName,
  programId,
  modules,
}: {
  programName: string;
  programId: string;
  modules: Module[];
}) {
  const [name, setName] = useState(programName);
  const [outline, setOutline] = useState(modules);
  const [whitbyMessages, setWhitbyMessages] = useState<WhitbyMessage[]>(() => [
    {
      id: "welcome",
      role: "whitby",
      content:
        "I'm your course co-author. I'll read what you say, understand it, then answer or edit — ask anything about this course, or tell me what to change.",
    },
  ]);

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
          <div className="flex items-center gap-2">
            <span
              className="inline-flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-white"
              style={{ background: "var(--accent, #2383e2)" }}
            >
              W
            </span>
            <span className="text-[14px] font-semibold" style={{ color: "var(--ink)" }}>
              Building with Whitby — new program
            </span>
          </div>
          <Pill tone="neutral">Draft, unsaved</Pill>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            href={`/academy/admin/catalog/${programId}`}
            className="!py-1.5 !text-[13px]"
          >
            Save as draft
          </Button>
          <Button
            variant="primary"
            href={`/academy/admin/catalog/${programId}`}
            className="!py-1.5 !text-[13px]"
          >
            Open in Course Builder to edit →
          </Button>
        </div>
      </div>

      {/* Body: chat left, outline right */}
      <div className="flex flex-1">
        {/* Chat panel */}
        <div
          className="w-[320px] shrink-0 border-r"
          style={{ borderColor: "var(--border)" }}
        >
          <WhitbyChat
            messages={whitbyMessages}
            onMessagesChange={setWhitbyMessages}
            placeholder="Add lessons, a video, a quiz, or an assignment…"
            suggestions={["Add 2 lessons", "Add a video", "Add a quiz", "Add an assignment"]}
            onSend={async (message) => {
              const recentChat = whitbyMessages
                .filter((entry) => entry.id !== "welcome")
                .slice(-14)
                .map((entry) => ({
                  role: entry.role === "user" ? ("user" as const) : ("whitby" as const),
                  content: entry.content,
                }));
              const result = await refineCatalogProgramAction(programId, message, {
                context: { focus: "program", recentChat },
                actionId: crypto.randomUUID(),
              });
              if (!result.ok) {
                return result.message ?? "Whitby could not revise the draft.";
              }
              const summary = result.summary?.trim() || "Updated the program outline.";
              if (result.mutated === false) {
                return summary;
              }
              setName(result.programName);
              setOutline(
                result.modules.map((module) => ({
                  title: module.title,
                  lessonCount: module.lessons.length,
                  isNew: false,
                  isUpdated: true,
                })),
              );
              return `Done — ${summary} The outline on the left is updated.`;
            }}
          />
        </div>

        {/* Live outline */}
        <div className="flex-1 px-8 py-6">
          <p
            className="text-[11px] font-semibold tracking-[.06em] uppercase"
            style={{ color: "var(--text-tertiary)" }}
          >
            Live outline — Whitby updates this as you chat
          </p>

          <input
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="mt-3 w-full border-b pb-2 text-[18px] font-semibold outline-none"
            style={{
              color: "var(--ink)",
              borderColor: "var(--border)",
              background: "transparent",
            }}
          />

          <div className="mt-6 flex flex-col gap-1">
            {outline.map((mod, i) => (
              <div
                key={i}
                className="rounded-[8px] border px-4 py-3"
                style={{
                  borderColor: mod.isNew
                    ? "var(--accent, #2383e2)"
                    : "var(--border)",
                  background: mod.isNew ? "var(--accent-tint-soft, #f4f9fe)" : "var(--surface)",
                }}
              >
                <div className="flex items-center gap-2">
                  <span className="text-[14px] font-medium" style={{ color: "var(--ink)" }}>
                    {i + 1}. {mod.title}
                  </span>
                  {mod.isUpdated ? (
                    <span className="text-[11px] font-medium" style={{ color: "var(--accent)" }}>
                      · updated
                    </span>
                  ) : null}
                  {mod.isNew ? (
                    <span className="text-[11px] font-medium" style={{ color: "var(--accent)" }}>
                      · new
                    </span>
                  ) : null}
                </div>
                <p className="mt-0.5 text-[12px]" style={{ color: "var(--text-tertiary)" }}>
                  {mod.lessonCount} lessons
                </p>
              </div>
            ))}
          </div>

          <div
            className="mt-4 rounded-[8px] border px-4 py-3"
            style={{ borderColor: "var(--border)", background: "var(--surface)" }}
          >
            <span className="text-[14px] font-medium" style={{ color: "var(--ink)" }}>
              Final assessment — scenario-based
            </span>
            <p className="mt-0.5 text-[12px]" style={{ color: "var(--text-tertiary)" }}>
              8 questions, applied case scenarios
            </p>
          </div>

          <p className="mt-6 text-[13px]" style={{ color: "var(--text-tertiary)" }}>
            Keep chatting to refine the structure, or open it in Course Builder to write lesson
            content, edit manually, preview, and publish.
          </p>
        </div>
      </div>
    </div>
  );
}
