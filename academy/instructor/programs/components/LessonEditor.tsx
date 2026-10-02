import { Input } from "@/base/components/Input";
import type { EditorLesson } from "../types";
import { CONTENT_URL_MAX, TITLE_MAX } from "../utils/validation";
import { LessonTypeSelector } from "./LessonTypeSelector";

export function LessonEditor({
  lesson,
  disabled,
  onChange,
}: {
  lesson: EditorLesson;
  disabled?: boolean;
  onChange: (patch: Partial<EditorLesson>) => void;
}) {
  const needsPath = lesson.type !== "quiz";

  return (
    <div className="space-y-4">
      <Input
        label="Lesson title"
        name="lesson-title"
        value={lesson.title}
        maxLength={TITLE_MAX}
        disabled={disabled}
        onChange={(event) => onChange({ title: event.target.value })}
      />
      <LessonTypeSelector
        value={lesson.type}
        disabled={disabled}
        onChange={(type) => onChange({ type })}
      />
      {needsPath ? (
        <Input
          label={lesson.type === "reading" ? "Reading path or URL" : "File path or URL"}
          name="content-url"
          value={lesson.contentUrl}
          maxLength={CONTENT_URL_MAX}
          disabled={disabled}
          hint="Private storage object path or https link. Uploads are not available in this editor."
          onChange={(event) => onChange({ contentUrl: event.target.value })}
        />
      ) : (
        <p className="text-[13px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
          {lesson.quizId
            ? "A quiz record exists for this lesson. Open the Quiz Editor from the lesson panel to author questions."
            : "Saving this draft will create an empty quiz record. Save first, then open the Quiz Editor to author questions."}
        </p>
      )}
    </div>
  );
}
