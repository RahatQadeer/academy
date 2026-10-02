import type { AcademyLessonType } from "@/academy/lib/domain";
import type { EditorLesson } from "../types";
import { lessonTypeLabel } from "../utils/lessonMeta";
import { LessonTypeIcon } from "./LessonTypeIcon";
import { ReorderButtons } from "./ReorderButtons";

function lessonMeta(lesson: EditorLesson) {
  const type = lessonTypeLabel(lesson.type);
  if (lesson.type === "quiz") {
    return lesson.quizId ? `${type} · ready` : `${type} · pending`;
  }
  return type;
}

export function LessonList({
  lessons,
  selectedKey,
  disabled,
  onSelect,
  onMove,
}: {
  lessons: (EditorLesson & { clientKey: string })[];
  selectedKey: string | null;
  disabled?: boolean;
  onSelect: (key: string) => void;
  onMove: (from: number, to: number) => void;
}) {
  if (lessons.length === 0) {
    return (
      <p className="px-2 py-2 text-[12.5px]" style={{ color: "var(--text-tertiary)" }}>
        No lessons yet
      </p>
    );
  }

  return (
    <ul className="space-y-0.5">
      {lessons.map((lesson, index) => {
        const selected = lesson.clientKey === selectedKey;
        return (
          <li key={lesson.clientKey} className="group/lesson flex items-start gap-0.5">
            <button
              type="button"
              className="flex min-w-0 flex-1 items-start gap-2 rounded-[7px] px-2 py-1.5 text-left"
              style={{
                background: selected ? "var(--accent-tint)" : "transparent",
                color: selected ? "var(--accent)" : "inherit",
              }}
              onClick={() => onSelect(lesson.clientKey)}
            >
              <span
                className="mt-0.5 shrink-0"
                style={{ color: selected ? "var(--accent)" : "var(--text-tertiary)" }}
              >
                <LessonTypeIcon type={lesson.type as AcademyLessonType} />
              </span>
              <span className="min-w-0 flex-1">
                <span
                  className="block text-[13px] font-medium leading-snug"
                  style={{
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                  }}
                >
                  {lesson.title.trim() || "Untitled lesson"}
                </span>
                <span
                  className="mt-0.5 block text-[11.5px] font-normal"
                  style={{ color: selected ? "color-mix(in srgb, var(--accent) 72%, var(--ink))" : "var(--text-tertiary)" }}
                >
                  {lessonMeta(lesson)}
                </span>
              </span>
            </button>
            <ReorderButtons
              label="lesson"
              disabled={disabled}
              isFirst={index === 0}
              isLast={index === lessons.length - 1}
              onUp={() => onMove(index, index - 1)}
              onDown={() => onMove(index, index + 1)}
            />
          </li>
        );
      })}
    </ul>
  );
}
