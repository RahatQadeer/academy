"use client";

import {
  countLessons,
  estimatedDuration,
  formatMinutes,
  lessonMinutes,
  totalMinutes,
} from "../lib/programStats";
import type { CatalogLesson, CatalogModule, CatalogProgramDetail } from "../types";

export function BuilderInspector({
  program,
  module,
  lesson,
}: {
  program: CatalogProgramDetail;
  module?: CatalogModule;
  lesson?: CatalogLesson;
}) {
  return (
    <aside className="h-full overflow-y-auto px-4 py-5">
      {lesson && module ? (
        <LessonInfo lesson={lesson} module={module} program={program} />
      ) : (
        <CourseInfo program={program} />
      )}
    </aside>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-6">
      <h2
        className="mb-2 text-[11px] font-semibold uppercase tracking-[0.09em]"
        style={{ color: "var(--text-tertiary)" }}
      >
        {title}
      </h2>
      {children}
    </section>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5">
      <span className="shrink-0 text-[12px]" style={{ color: "var(--text-tertiary)" }}>
        {label}
      </span>
      <span className="text-right text-[12.5px] font-medium" style={{ color: "var(--ink)" }}>
        {value}
      </span>
    </div>
  );
}

function CourseInfo({ program }: { program: CatalogProgramDetail }) {
  return (
    <>
      <Group title="Course">
        <div className="divide-y" style={{ borderColor: "var(--border)" }}>
          <Row label="Level" value={program.category || program.type || "—"} />
          <Row label="Duration" value={estimatedDuration(program)} />
          <Row label="Learning time" value={formatMinutes(totalMinutes(program))} />
          <Row label="Modules" value={String(program.modules.length)} />
          <Row label="Lessons" value={String(countLessons(program))} />
          <Row label="Language" value="English" />
          <Row label="Status" value={program.status === "published" ? "Published" : "Draft"} />
        </div>
      </Group>
    </>
  );
}

function LessonInfo({
  lesson,
  module,
  program,
}: {
  lesson: CatalogLesson;
  module: CatalogModule;
  program: CatalogProgramDetail;
}) {
  const position = module.lessons.findIndex((entry) => entry.id === lesson.id) + 1;
  const words = `${lesson.contentSummary} ${lesson.contentBody}`
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;

  return (
    <>
      <Group title="Lesson">
        <div>
          <Row label="Position" value={`${position} of ${module.lessons.length}`} />
          <Row label="Type" value={labelForType(lesson.type)} />
          <Row label="Duration" value={formatMinutes(lessonMinutes(lesson))} />
          <Row label="Words" value={words.toLocaleString()} />
          <Row
            label="Quiz"
            value={lesson.quiz ? `${lesson.quiz.questions.length} questions` : "None"}
          />
        </div>
      </Group>
      {lesson.learningObjectives.length > 0 ? (
        <Group title="Objectives">
          <ul className="space-y-2">
            {lesson.learningObjectives.map((objective) => (
              <li
                key={objective}
                className="flex gap-2 text-[12.5px] leading-relaxed"
                style={{ color: "var(--text-secondary)" }}
              >
                <span
                  className="mt-[0.55em] size-1 shrink-0 rounded-full"
                  style={{ background: "var(--accent, #2383e2)" }}
                />
                {objective}
              </li>
            ))}
          </ul>
        </Group>
      ) : null}
      <Group title="Module">
        <p className="text-[12.5px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
          {module.title}
        </p>
      </Group>
      <Group title="Course">
        <p className="text-[12.5px]" style={{ color: "var(--text-secondary)" }}>
          {program.name}
        </p>
      </Group>
    </>
  );
}

function labelForType(type: CatalogLesson["type"]) {
  return type.replace(/_/g, " ");
}
