import type { EditorLesson, EditorModule } from "../types";
import { LessonList } from "./LessonList";
import { ReorderButtons } from "./ReorderButtons";

export type DraftLesson = EditorLesson & { clientKey: string };

export type DraftModule = Omit<EditorModule, "lessons"> & {
  clientKey: string;
  lessons: DraftLesson[];
};

export function ModuleList({
  modules,
  selectedModuleKey,
  selectedLessonKey,
  disabled,
  onSelectModule,
  onSelectLesson,
  onMoveModule,
  onMoveLesson,
  onAddLesson,
}: {
  modules: DraftModule[];
  selectedModuleKey: string | null;
  selectedLessonKey: string | null;
  disabled?: boolean;
  onSelectModule: (key: string) => void;
  onSelectLesson: (moduleKey: string, lessonKey: string) => void;
  onMoveModule: (from: number, to: number) => void;
  onMoveLesson: (moduleKey: string, from: number, to: number) => void;
  onAddLesson: (moduleKey: string) => void;
}) {
  if (modules.length === 0) {
    return (
      <p className="px-1 py-3 text-[13px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
        No modules yet. Add a module to start the course structure.
      </p>
    );
  }

  return (
    <div className="space-y-1">
      {modules.map((module, index) => {
        const moduleSelected = module.clientKey === selectedModuleKey && !selectedLessonKey;
        const lessonCount = module.lessons.length;

        return (
          <div key={module.clientKey} className="group/module">
            <div className="flex items-start gap-0.5">
              <button
                type="button"
                className="min-w-0 flex-1 rounded-[7px] px-2 py-2 text-left"
                style={{
                  background: moduleSelected ? "var(--accent-tint)" : "transparent",
                  color: moduleSelected ? "var(--accent)" : "inherit",
                }}
                onClick={() => onSelectModule(module.clientKey)}
              >
                <span className="flex items-start gap-2">
                  <span
                    className="mt-px shrink-0 text-[12px] font-semibold tabular-nums"
                    style={{ color: moduleSelected ? "var(--accent)" : "var(--text-tertiary)" }}
                  >
                    {index + 1}.
                  </span>
                  <span className="min-w-0">
                    <span
                      className="block text-[13.5px] font-semibold leading-snug"
                      style={{
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                      }}
                    >
                      {module.title.trim() || "Untitled module"}
                    </span>
                    <span
                      className="mt-0.5 block text-[11.5px] font-normal"
                      style={{
                        color: moduleSelected
                          ? "color-mix(in srgb, var(--accent) 72%, var(--ink))"
                          : "var(--text-tertiary)",
                      }}
                    >
                      {lessonCount === 1 ? "1 lesson" : `${lessonCount} lessons`}
                    </span>
                  </span>
                </span>
              </button>
              <ReorderButtons
                label="module"
                disabled={disabled}
                isFirst={index === 0}
                isLast={index === modules.length - 1}
                onUp={() => onMoveModule(index, index - 1)}
                onDown={() => onMoveModule(index, index + 1)}
              />
            </div>

            <div className="ml-3 mt-0.5 border-l pl-1.5" style={{ borderColor: "var(--border)" }}>
              <LessonList
                lessons={module.lessons}
                selectedKey={module.clientKey === selectedModuleKey ? selectedLessonKey : null}
                disabled={disabled}
                onSelect={(key) => onSelectLesson(module.clientKey, key)}
                onMove={(from, to) => onMoveLesson(module.clientKey, from, to)}
              />
              <button
                type="button"
                disabled={disabled}
                className="mt-0.5 w-full rounded-[7px] px-2 py-1.5 text-left text-[12.5px] font-medium hover:bg-[color:var(--accent-tint)] disabled:opacity-40"
                style={{ color: "var(--accent)" }}
                onClick={() => onAddLesson(module.clientKey)}
              >
                + Add lesson
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
