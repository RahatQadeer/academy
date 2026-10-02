import { programTypeLabel } from "@/academy/lib/domain";
import { programStatusLabel } from "@/academy/instructor/utils/labels";
import type { ApprovalRequestDetail } from "../../types";

export function ProgramReviewSummary({ detail }: { detail: ApprovalRequestDetail }) {
  const { program, modules } = detail;
  const lessonCount = modules.reduce((sum, module) => sum + module.lessons.length, 0);
  const quizCount = modules.reduce(
    (sum, module) => sum + module.lessons.filter((lesson) => lesson.hasQuiz || lesson.type === "quiz").length,
    0,
  );

  return (
    <section className="space-y-6">
      <div
        className="rounded-[10px] bg-surface p-5"
        style={{ border: "1px solid var(--border)" }}
      >
        <h2 className="text-[13.5px] font-medium">Program</h2>
        <dl className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <dt className="text-[12px] uppercase tracking-[0.05em]" style={{ color: "var(--text-tertiary)" }}>
              Type
            </dt>
            <dd className="mt-1 text-[14px]">{programTypeLabel(program.type)}</dd>
          </div>
          <div>
            <dt className="text-[12px] uppercase tracking-[0.05em]" style={{ color: "var(--text-tertiary)" }}>
              Category
            </dt>
            <dd className="mt-1 text-[14px]">{program.category.trim() || "None"}</dd>
          </div>
          <div>
            <dt className="text-[12px] uppercase tracking-[0.05em]" style={{ color: "var(--text-tertiary)" }}>
              Price
            </dt>
            <dd className="mt-1 text-[14px]">{program.price}</dd>
          </div>
          <div>
            <dt className="text-[12px] uppercase tracking-[0.05em]" style={{ color: "var(--text-tertiary)" }}>
              Status
            </dt>
            <dd className="mt-1 text-[14px]">{programStatusLabel(program.status)}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-[12px] uppercase tracking-[0.05em]" style={{ color: "var(--text-tertiary)" }}>
              Prerequisite
            </dt>
            <dd className="mt-1 text-[14px]">{program.prerequisiteName || "None"}</dd>
          </div>
        </dl>
        <p className="mt-4 text-[13.5px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
          {program.description.trim() || "No description provided."}
        </p>
      </div>

      <div
        className="rounded-[10px] bg-surface p-5"
        style={{ border: "1px solid var(--border)" }}
      >
        <h2 className="text-[13.5px] font-medium">Structure</h2>
        <p className="mt-1 text-[12.5px]" style={{ color: "var(--text-tertiary)" }}>
          {modules.length} {modules.length === 1 ? "module" : "modules"} · {lessonCount}{" "}
          {lessonCount === 1 ? "lesson" : "lessons"}
          {quizCount > 0 ? ` · ${quizCount} quiz ${quizCount === 1 ? "lesson" : "lessons"}` : ""}
        </p>
        {modules.length === 0 ? (
          <p className="mt-4 text-[13.5px]" style={{ color: "var(--text-secondary)" }}>
            This program has no modules yet.
          </p>
        ) : (
          <div className="mt-4 space-y-4">
            {modules.map((module, moduleIndex) => (
              <div key={module.id}>
                <h3 className="text-[14.5px] font-medium">
                  {moduleIndex + 1}. {module.title}
                </h3>
                {module.lessons.length === 0 ? (
                  <p className="mt-1 text-[13px]" style={{ color: "var(--text-tertiary)" }}>
                    No lessons
                  </p>
                ) : (
                  <ol className="mt-2 space-y-1">
                    {module.lessons.map((lesson) => (
                      <li key={lesson.id} className="text-[13px]" style={{ color: "var(--text-secondary)" }}>
                        {lesson.title}
                        <span className="ml-2 text-[12px]" style={{ color: "var(--text-tertiary)" }}>
                          {lesson.type}
                          {lesson.hasQuiz ? " · quiz record" : ""}
                        </span>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
