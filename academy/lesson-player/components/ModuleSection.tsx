"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import type { AcademyLessonType } from "@/academy/lib/domain";
import type { CurriculumLesson } from "../types";
import { lessonPlayerHref } from "../utils/curriculum";

export function ModuleSection({
  title,
  programId,
  lessons,
  currentLessonId,
}: {
  title: string;
  programId: string;
  lessons: CurriculumLesson[];
  currentLessonId: string;
}) {
  return (
    <section className="mb-5">
      <h2
        className="mb-1.5 px-2 text-[10.5px] font-semibold uppercase tracking-[0.07em]"
        style={{ color: "var(--text-tertiary)" }}
      >
        {title}
      </h2>
      <ul>
        {lessons.map((lesson, index) => (
          <LessonRow
            key={lesson.id}
            lesson={lesson}
            index={index}
            programId={programId}
            current={lesson.id === currentLessonId}
          />
        ))}
      </ul>
    </section>
  );
}

function LessonRow({
  lesson,
  index,
  programId,
  current,
}: {
  lesson: CurriculumLesson;
  index: number;
  programId: string;
  current: boolean;
}) {
  const ref = useRef<HTMLLIElement>(null);
  const locked = lesson.progressStatus === "locked";
  const completed = lesson.progressStatus === "completed";

  useEffect(() => {
    if (current) {
      ref.current?.scrollIntoView({ block: "nearest" });
    }
  }, [current]);

  const className =
    "relative flex items-start gap-2 rounded-[8px] px-2 py-[8px] text-[12.5px] leading-snug no-underline";

  const inner = (
    <>
      {current ? (
        <span
          aria-hidden
          className="absolute top-[7px] bottom-[7px] left-0 w-[2.5px] rounded-full"
          style={{ background: "var(--accent)" }}
        />
      ) : null}
      <span
        className="mt-[1px] inline-flex h-[16px] w-[16px] shrink-0 items-center justify-center rounded-full"
        style={{
          background: completed
            ? "var(--success-bg)"
            : current
              ? "var(--accent-tint)"
              : "transparent",
          color: completed ? "var(--success-fg)" : current ? "var(--accent)" : "var(--text-tertiary)",
          border: completed || current ? "none" : "1px solid var(--border-strong)",
        }}
        aria-hidden
      >
        {completed ? <CheckIcon /> : locked ? <LockIcon /> : null}
      </span>
      <span className="min-w-0">
        <span
          className="block"
          style={{
            color: locked ? "var(--text-disabled)" : "var(--ink)",
            fontWeight: current ? 600 : 400,
          }}
        >
          {lesson.title}
        </span>
        <span className="mt-0.5 block text-[10.5px]" style={{ color: "var(--text-tertiary)" }}>
          {String(index + 1).padStart(2, "0")} · {typeLabel(lesson.type)}
        </span>
      </span>
    </>
  );

  if (locked) {
    return (
      <li ref={ref}>
        <span className={className}>{inner}</span>
      </li>
    );
  }

  return (
    <li ref={ref}>
      <Link
        href={lessonPlayerHref(programId, lesson.id)}
        aria-current={current ? "page" : undefined}
        className={`${className} hover:bg-black/[0.035]`}
        style={{
          background: current ? "var(--surface)" : "transparent",
          color: "var(--ink)",
          boxShadow: current ? "0 0 0 1px var(--border)" : undefined,
        }}
      >
        {inner}
      </Link>
    </li>
  );
}

function typeLabel(type: AcademyLessonType) {
  if (type === "quiz") return "Quiz";
  if (type === "video") return "Video";
  if (type === "assignment") return "Assignment";
  if (type === "attachment") return "File";
  if (type === "scenario") return "Scenario";
  if (type === "resource") return "Resource";
  return "Reading";
}

function CheckIcon() {
  return (
    <svg width="9" height="9" viewBox="0 0 16 16" fill="none">
      <path
        d="M3.5 8.2 6.6 11.2 12.5 4.8"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg width="8" height="8" viewBox="0 0 12 12" fill="none">
      <path
        d="M3.5 5.5V4.2a2.5 2.5 0 0 1 5 0v1.3M3 5.5h6v4.5H3V5.5Z"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
