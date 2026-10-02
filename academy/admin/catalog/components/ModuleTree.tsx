"use client";

import { useEffect, useRef, useState } from "react";
import { formatMinutes, lessonMinutes } from "../lib/programStats";
import type { CatalogLesson, CatalogModule } from "../types";
import { briefHasBankPrompt } from "@/academy/lib/questionBank/bankOrigin";

export type TreeModule = {
  id: string;
  title: string;
  lessons: { id: string; title: string }[];
};

export type BuilderNode = { kind: "overview" } | { kind: "lesson"; moduleId: string; lessonId: string };

function lessonHasIncludedContent(lesson: CatalogLesson) {
  if (lesson.quiz?.questions.some((question) => question.fromBank)) return true;
  if (lesson.assignment && briefHasBankPrompt(lesson.assignment.brief)) return true;
  return false;
}

function lessonMetaLabel(lesson: CatalogLesson) {
  if (lesson.quiz) {
    const count = lesson.quiz.questions.length;
    return `${count} question${count === 1 ? "" : "s"}`;
  }
  if (lesson.type === "assignment") {
    const minutes = lesson.assignment?.estimatedMinutes?.trim();
    if (minutes) return `${minutes} min`;
  }
  if (lesson.type === "video" && lesson.videoDurationSeconds > 0) {
    return formatMinutes(Math.max(1, Math.ceil(lesson.videoDurationSeconds / 60)));
  }
  return formatMinutes(lessonMinutes(lesson));
}

function OutlineStar() {
  return (
    <svg width="10" height="10" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M8 1.6l1.76 3.56 3.93.57-2.84 2.77.67 3.91L8 10.56l-3.52 1.85.67-3.91L2.3 5.73l3.93-.57L8 1.6z"
        fill="currentColor"
      />
    </svg>
  );
}

export function ModuleTree({
  modules,
  selected,
  onSelect,
  onAddModule,
  onAddLesson,
  onRenameModule,
  onDeleteModule,
  onDeleteLesson,
  onMoveModule,
  onMoveLesson,
}: {
  modules: CatalogModule[];
  selected: BuilderNode;
  onSelect: (node: BuilderNode) => void;
  onAddModule?: (afterModuleId?: string) => void;
  onAddLesson?: (moduleId: string) => void;
  onRenameModule?: (moduleId: string, title: string) => void;
  onDeleteModule?: (moduleId: string) => void;
  onDeleteLesson?: (moduleId: string, lessonId: string) => void;
  onMoveModule?: (moduleId: string, direction: -1 | 1) => void;
  onMoveLesson?: (moduleId: string, lessonId: string, direction: -1 | 1) => void;
}) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const selectedLessonId = selected.kind === "lesson" ? selected.lessonId : null;
  const overviewActive = selected.kind === "overview";
  const lessonTotal = modules.reduce((sum, module) => sum + module.lessons.length, 0);

  return (
    <nav className="flex flex-col px-2.5 py-3.5 pb-10">
      <button
        type="button"
        onClick={() => onSelect({ kind: "overview" })}
        className="group flex w-full items-center gap-3 rounded-[12px] border px-3 py-3 text-left transition-colors"
        style={{
          borderColor: overviewActive ? "color-mix(in srgb, var(--accent) 35%, var(--border))" : "var(--border)",
          background: overviewActive
            ? "linear-gradient(135deg, var(--accent-tint) 0%, var(--surface) 100%)"
            : "var(--surface)",
          boxShadow: overviewActive
            ? "0 6px 16px color-mix(in srgb, var(--accent) 12%, transparent)"
            : "0 1px 2px rgba(15,15,15,.03)",
        }}
      >
        <span
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px]"
          style={{
            background: overviewActive ? "var(--accent)" : "var(--surface-soft)",
            color: overviewActive ? "#fff" : "var(--text-secondary)",
          }}
          aria-hidden
        >
          <OverviewIcon />
        </span>
        <span className="min-w-0 flex-1">
          <span
            className="block text-[13px] font-semibold tracking-[-0.01em]"
            style={{ color: overviewActive ? "var(--accent)" : "var(--ink)" }}
          >
            Course overview
          </span>
          <span className="mt-0.5 block text-[11.5px]" style={{ color: "var(--text-tertiary)" }}>
            {modules.length} module{modules.length === 1 ? "" : "s"}
            {" · "}
            {lessonTotal} lesson{lessonTotal === 1 ? "" : "s"}
          </span>
        </span>
      </button>

      <div className="mt-5 mb-2.5 flex items-center justify-between gap-2 px-1">
        <p
          className="text-[10.5px] font-semibold uppercase tracking-[0.09em]"
          style={{ color: "var(--text-tertiary)" }}
        >
          Outline
        </p>
        {modules.length > 0 ? (
          <span className="text-[11px] tabular-nums" style={{ color: "var(--text-tertiary)" }}>
            {modules.length}
          </span>
        ) : null}
      </div>

      <div className="space-y-2">
        {modules.map((module, moduleIndex) => {
          const isCollapsed = collapsed[module.id];
          const minutes = module.lessons.reduce((sum, lesson) => sum + lessonMinutes(lesson), 0);
          const hasActiveLesson =
            selected.kind === "lesson" && selected.moduleId === module.id;

          const moduleMenu = [
            onAddLesson
              ? { label: "Add empty lesson", onSelect: () => onAddLesson(module.id) }
              : null,
            onMoveModule
              ? {
                  label: "Move up",
                  disabled: moduleIndex === 0,
                  onSelect: () => onMoveModule(module.id, -1),
                }
              : null,
            onMoveModule
              ? {
                  label: "Move down",
                  disabled: moduleIndex === modules.length - 1,
                  onSelect: () => onMoveModule(module.id, 1),
                }
              : null,
            onAddModule
              ? { label: "Add module below", onSelect: () => onAddModule(module.id) }
              : null,
            onDeleteModule
              ? {
                  label: "Delete module",
                  danger: true,
                  onSelect: () => onDeleteModule(module.id),
                }
              : null,
          ].filter((item): item is NonNullable<typeof item> => item !== null);

          return (
            <div
              key={module.id}
              className="rounded-[12px] border"
              style={{
                borderColor: hasActiveLesson
                  ? "color-mix(in srgb, var(--accent) 38%, var(--border))"
                  : "color-mix(in srgb, var(--accent) 18%, var(--border))",
                background: "var(--surface)",
                boxShadow: hasActiveLesson
                  ? "0 4px 12px color-mix(in srgb, var(--accent) 10%, transparent)"
                  : "0 1px 2px rgba(15,15,15,.03)",
              }}
            >
              <div
                className={`group/module relative flex items-start gap-2 py-2 pl-2.5 pr-8 ${
                  isCollapsed ? "rounded-[12px]" : "rounded-t-[12px]"
                }`}
                style={{
                  background: hasActiveLesson ? "var(--accent-tint)" : "var(--accent-tint-mid)",
                }}
              >
                <span
                  className="mt-px inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-[7px] text-[11px] font-semibold tabular-nums leading-none"
                  style={{
                    background: "var(--accent)",
                    color: "#fff",
                  }}
                >
                  {moduleIndex + 1}
                </span>

                <div className="min-w-0 flex-1">
                  <ModuleTitleField
                    value={module.title}
                    readOnly={!onRenameModule}
                    onChange={(title) => onRenameModule?.(module.id, title)}
                  />
                  <p
                    className="mt-1 text-[11px] leading-snug tabular-nums"
                    style={{ color: "var(--text-tertiary)" }}
                  >
                    {module.lessons.length} lesson{module.lessons.length === 1 ? "" : "s"}
                    {minutes ? ` · ${formatMinutes(minutes)}` : ""}
                  </p>
                </div>

                {moduleMenu.length > 0 ? (
                  <div className="absolute right-7 top-1.5">
                    <RowMenu items={moduleMenu} />
                  </div>
                ) : null}

                <button
                  type="button"
                  aria-label={isCollapsed ? "Expand module" : "Collapse module"}
                  onClick={() =>
                    setCollapsed((current) => ({ ...current, [module.id]: !current[module.id] }))
                  }
                  className="absolute right-1.5 top-1.5 inline-flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-[7px] transition-colors hover:bg-black/[0.04]"
                  style={{ background: "transparent", border: "none", color: "var(--accent)" }}
                >
                  <Chevron open={!isCollapsed} />
                </button>
              </div>

              {!isCollapsed ? (
                <div
                  className="space-y-0.5 rounded-b-[12px] border-t px-1.5 py-1.5"
                  style={{
                    borderColor: "var(--border)",
                    background: "var(--surface)",
                  }}
                >
                  {module.lessons.map((lesson, lessonIndex) => {
                    const active = selectedLessonId === lesson.id;
                    const dim = !lesson.contentBody && !lesson.quiz;
                    const included = lessonHasIncludedContent(lesson);
                    const meta = lessonMetaLabel(lesson);
                    return (
                      <div
                        key={lesson.id}
                        className={[
                          "group/row relative flex items-stretch rounded-[9px] border transition-[background-color,border-color]",
                          "hover:border-[color:var(--accent)] hover:bg-[var(--surface)]",
                          active ? "bg-[color:var(--accent-tint)]" : "border-transparent bg-transparent",
                        ].join(" ")}
                        style={
                          active
                            ? { borderColor: "color-mix(in srgb, var(--accent) 45%, var(--border))" }
                            : undefined
                        }
                      >
                        <button
                          type="button"
                          onClick={() =>
                            onSelect({ kind: "lesson", moduleId: module.id, lessonId: lesson.id })
                          }
                          className="relative flex min-w-0 flex-1 items-start gap-2 rounded-[9px] border-none bg-transparent py-2 pl-2 pr-7 text-left"
                          style={{
                            color: active ? "var(--accent)" : "var(--text-secondary)",
                          }}
                        >
                          {active ? (
                            <span
                              className="absolute top-2 bottom-2 left-0 w-[2.5px] rounded-full"
                              style={{ background: "var(--accent)" }}
                              aria-hidden
                            />
                          ) : null}
                          <span
                            className="w-5 shrink-0 pt-px text-right text-[12px] font-semibold tabular-nums"
                            style={{ color: active ? "var(--accent)" : "var(--text-tertiary)" }}
                          >
                            {lessonIndex + 1}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="flex items-start gap-1.5">
                              <span
                                className="min-w-0 flex-1 text-[12.5px] font-medium leading-[1.35] break-words"
                                style={{
                                  fontWeight: active ? 600 : 500,
                                  fontStyle: dim && !active ? "italic" : "normal",
                                  color: dim && !active ? "var(--text-tertiary)" : undefined,
                                }}
                              >
                                {lesson.title || "Untitled lesson"}
                              </span>
                              {included ? (
                                <span
                                  className="mt-0.5 inline-flex h-[16px] w-[16px] shrink-0 items-center justify-center rounded-full"
                                  title="Includes question-bank items"
                                  aria-label="Includes question-bank items"
                                  style={{
                                    background: "color-mix(in srgb, #c9a227 18%, white)",
                                    color: "#8a6d12",
                                    boxShadow:
                                      "inset 0 0 0 1px color-mix(in srgb, #c9a227 35%, transparent)",
                                  }}
                                >
                                  <OutlineStar />
                                </span>
                              ) : null}
                            </span>
                            <span
                              className="mt-0.5 block text-[10.5px] leading-snug tabular-nums"
                              style={{ color: "var(--text-tertiary)" }}
                            >
                              {meta}
                            </span>
                          </span>
                        </button>
                        <div className="absolute right-0.5 top-1">
                          <RowMenu
                            items={[
                              onMoveLesson
                                ? {
                                    label: "Move up",
                                    disabled: lessonIndex === 0,
                                    onSelect: () => onMoveLesson(module.id, lesson.id, -1),
                                  }
                                : null,
                              onMoveLesson
                                ? {
                                    label: "Move down",
                                    disabled: lessonIndex === module.lessons.length - 1,
                                    onSelect: () => onMoveLesson(module.id, lesson.id, 1),
                                  }
                                : null,
                              onDeleteLesson
                                ? {
                                    label: "Delete lesson",
                                    danger: true,
                                    onSelect: () => onDeleteLesson(module.id, lesson.id),
                                  }
                                : null,
                            ].filter((item): item is NonNullable<typeof item> => Boolean(item))}
                          />
                        </div>
                      </div>
                    );
                  })}

                  {onAddLesson ? (
                    <button
                      type="button"
                      onClick={() => onAddLesson(module.id)}
                      className="mt-0.5 flex w-full cursor-pointer items-center gap-1.5 rounded-[9px] px-2.5 py-2 text-left text-[12px] font-medium transition-colors hover:bg-[var(--accent-tint-soft)]"
                      style={{ color: "var(--accent)", background: "transparent", border: "none" }}
                    >
                      <PlusIcon />
                      Add lesson
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      {onAddModule ? (
        <button
          type="button"
          onClick={() => onAddModule()}
          className="mt-3 flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-[12px] border border-dashed px-3 py-2.5 text-[13px] font-medium transition-colors hover:bg-[var(--surface)]"
          style={{
            borderColor: "var(--border-strong)",
            color: "var(--ink)",
            background: "transparent",
          }}
        >
          <PlusIcon />
          Add module
        </button>
      ) : null}
    </nav>
  );
}

function OverviewIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <rect x="2" y="2.5" width="12" height="3" rx="1" stroke="currentColor" strokeWidth="1.4" />
      <rect x="2" y="7" width="12" height="3" rx="1" stroke="currentColor" strokeWidth="1.4" />
      <rect x="2" y="11.5" width="8" height="2.5" rx="1" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      aria-hidden
      style={{
        transform: open ? "rotate(90deg)" : "none",
        transition: "transform 140ms ease",
      }}
    >
      <path
        d="M4.5 2.5 8 6l-3.5 3.5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
      <path d="M6 2.5v7M2.5 6h7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function ModuleTitleField({
  value,
  onChange,
  readOnly,
}: {
  value: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (!editing) return;
    const el = ref.current;
    if (!el) return;
    el.focus();
    el.select();
    el.style.height = "0px";
    el.style.height = `${el.scrollHeight}px`;
  }, [editing]);

  useEffect(() => {
    if (!editing) return;
    const el = ref.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${el.scrollHeight}px`;
  }, [editing, value]);

  if (readOnly || !editing) {
    return (
      <button
        type="button"
        title={value}
        disabled={readOnly}
        onClick={() => {
          if (!readOnly) setEditing(true);
        }}
        className="m-0 w-full cursor-text border-none bg-transparent p-0 text-left disabled:cursor-default"
      >
        <span
          className="block text-[13px] font-semibold leading-[1.35] tracking-[-0.02em] break-words"
          style={{ color: "var(--ink)" }}
        >
          {value || "Untitled module"}
        </span>
      </button>
    );
  }

  return (
    <textarea
      ref={ref}
      value={value}
      rows={1}
      onChange={(event) => onChange(event.target.value)}
      onBlur={() => setEditing(false)}
      onKeyDown={(event) => {
        if (event.key === "Enter" && !event.shiftKey) {
          event.preventDefault();
          setEditing(false);
        }
        if (event.key === "Escape") {
          event.preventDefault();
          setEditing(false);
        }
      }}
      className="min-w-0 w-full resize-none overflow-hidden bg-transparent text-[13px] font-semibold leading-[1.35] tracking-[-0.02em] outline-none"
      style={{
        color: "var(--ink)",
        border: "none",
        whiteSpace: "pre-wrap",
        overflowWrap: "break-word",
        fieldSizing: "content",
      }}
    />
  );
}

type MenuItem = {
  label: string;
  onSelect: () => void;
  disabled?: boolean;
  danger?: boolean;
};

function RowMenu({ items }: { items: MenuItem[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointer(event: MouseEvent) {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    }
    window.addEventListener("mousedown", onPointer);
    return () => window.removeEventListener("mousedown", onPointer);
  }, [open]);

  if (items.length === 0) return null;

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        aria-label="Options"
        onClick={() => setOpen((value) => !value)}
        className="inline-flex h-6 w-6 cursor-pointer items-center justify-center rounded-[7px] text-[13px] opacity-0 transition-opacity group-hover/module:opacity-100 group-hover/row:opacity-100 focus:opacity-100"
        style={{ color: "var(--text-tertiary)", background: "transparent", border: "none" }}
      >
        ···
      </button>
      {open ? (
        <div
          className="absolute right-0 z-20 mt-1 w-[188px] rounded-[10px] border py-1 shadow-[0_8px_24px_rgba(15,15,15,.1)]"
          style={{ borderColor: "var(--border)", background: "var(--surface)" }}
        >
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              disabled={item.disabled}
              onClick={() => {
                setOpen(false);
                item.onSelect();
              }}
              className="block w-full cursor-pointer px-3 py-2 text-left text-[12.5px] disabled:cursor-not-allowed disabled:opacity-30"
              style={{
                color: item.danger ? "#c4554d" : "var(--ink)",
                background: "transparent",
                border: "none",
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
