import Link from "next/link";

export function QuizEditorHeader({
  programId,
  programName,
  lessonTitle,
}: {
  programId: string;
  programName: string;
  lessonTitle: string;
}) {
  return (
    <header>
      <Link
        href={`/academy/instructor/programs/${programId}`}
        className="text-[13px] no-underline hover:text-accent-hover"
        style={{ color: "var(--accent)" }}
      >
        ← Course Builder
      </Link>
      <p
        className="mt-6 text-[12.5px] font-semibold uppercase tracking-[0.06em]"
        style={{ color: "var(--module-academy-fg)" }}
      >
        Quiz Editor
      </p>
      <h1 className="mt-1 text-[24px] font-bold tracking-[-0.3px] text-pretty">{lessonTitle}</h1>
      <p className="mt-1 text-[13.5px]" style={{ color: "var(--text-secondary)" }}>
        {programName}. Add custom questions here, or pull them from the question bank. Correct answers are
        visible here only. Learners never receive the answer key.
      </p>
    </header>
  );
}
