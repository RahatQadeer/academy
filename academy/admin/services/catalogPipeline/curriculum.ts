import "server-only";

import { generateJson } from "./deepseek";
import {
  DESIGNER_SYSTEM,
  briefBlock,
  calibrationBlock,
  jsonDiscipline,
} from "./prompts";
import type {
  Blueprint,
  CatalogGenerationRequest,
  CatalogLessonKind,
  LessonPlan,
  ModulePlan,
  Objectives,
} from "./types";

function sanitizeLessonKind(value: unknown): CatalogLessonKind {
  if (
    value === "scenario" ||
    value === "assignment" ||
    value === "quiz" ||
    value === "video" ||
    value === "resource"
  ) {
    return value;
  }
  return "reading";
}

function extractLessonArray(payload: unknown): unknown[] {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  if (typeof payload !== "object") return [];

  const record = payload as Record<string, unknown>;
  for (const key of ["lessons", "Lessons", "items", "plan", "lessonPlan"]) {
    const value = record[key];
    if (Array.isArray(value)) return value;
  }

  // Nested shapes: { data: { lessons: [...] } } or { module: { lessons: [...] } }
  for (const key of ["data", "module", "result", "output"]) {
    const nested = record[key];
    if (nested && typeof nested === "object") {
      const found = extractLessonArray(nested);
      if (found.length) return found;
    }
  }

  return [];
}

function normalizeLessonPlans(
  rawLessons: unknown[],
  modulePlan: ModulePlan,
): LessonPlan[] {
  return rawLessons
    .filter((lesson) => lesson && typeof lesson === "object")
    .slice(0, modulePlan.lessonCount)
    .map((lesson, index) => {
      const row = lesson as Record<string, unknown>;
      const outlineRaw = row.outline ?? row.beats ?? row.teachingBeats;
      return {
        title: String(row.title ?? "").trim() || `Lesson ${index + 1}`,
        summary: String(row.summary ?? row.description ?? "").trim(),
        lessonKind: sanitizeLessonKind(row.lessonKind ?? row.kind ?? row.type),
        learningObjectives: Array.isArray(row.learningObjectives)
          ? row.learningObjectives.map(String)
          : Array.isArray(row.objectives)
            ? row.objectives.map(String)
            : [],
        durationMinutes: Math.min(60, Math.max(8, Number(row.durationMinutes) || 20)),
        outline: Array.isArray(outlineRaw) ? outlineRaw.map(String) : [],
      };
    });
}

/**
 * Deterministic skeleton so a flaky LLM response never aborts the whole run.
 * Downstream writing stages still expand these into full lessons.
 */
export function buildFallbackLessonPlans(modulePlan: ModulePlan): LessonPlan[] {
  const focus = modulePlan.focus?.trim() || modulePlan.title;
  const objectives =
    modulePlan.learningObjectives.length > 0
      ? modulePlan.learningObjectives
      : [`Apply the core ideas in ${modulePlan.title}`];
  const count = Math.min(6, Math.max(4, modulePlan.lessonCount || 4));

  const templates: LessonPlan[] = [
    {
      title: `${modulePlan.title}: Core concepts`,
      summary: `Build a clear mental model of ${focus}.`,
      lessonKind: "reading",
      learningObjectives: objectives.slice(0, 2),
      durationMinutes: 25,
      outline: [
        `Define the problem ${modulePlan.title} solves`,
        `Explain the key mechanisms behind ${focus}`,
        "Walk through a concrete worked example",
        "Call out common misconceptions and failure modes",
        "Summarize decision criteria the learner should remember",
      ],
    },
    {
      title: `Scenario: Putting ${modulePlan.title} to work`,
      summary: `Apply ${focus} in a realistic situation with tradeoffs.`,
      lessonKind: "scenario",
      learningObjectives: objectives.slice(0, 2),
      durationMinutes: 20,
      outline: [
        "Set the scene and constraints",
        "Identify which module concepts apply",
        "Work the decision step by step",
        "Compare an alternate approach",
        "Capture the outcome and lessons learned",
      ],
    },
    {
      title: `Assignment: Practice ${modulePlan.title}`,
      summary: `Produce a graded deliverable that demonstrates ${focus}.`,
      lessonKind: "assignment",
      learningObjectives: objectives.slice(0, 2),
      durationMinutes: 35,
      outline: [
        "Restate the task and success criteria",
        "Gather the inputs the learner needs",
        "Execute the hands-on steps",
        "Validate the result against a rubric",
        "Reflect on what to improve next time",
      ],
    },
    {
      title: `Quiz: Check ${modulePlan.title}`,
      summary: `Confirm understanding of ${focus} before moving on.`,
      lessonKind: "quiz",
      learningObjectives: objectives.slice(0, 2),
      durationMinutes: 15,
      outline: [
        "Recall key definitions",
        "Apply concepts to short cases",
        "Spot incorrect reasoning",
        "Choose the better operational decision",
      ],
    },
  ];

  while (templates.length < count) {
    const objective = objectives[templates.length % objectives.length];
    templates.push({
      title: `${modulePlan.title}: Deep dive ${templates.length - 3}`,
      summary: `Go deeper on ${objective}.`,
      lessonKind: "reading",
      learningObjectives: [objective],
      durationMinutes: 22,
      outline: [
        `Revisit ${objective} with more detail`,
        "Show an advanced example",
        "Contrast with related techniques",
        "List practical guardrails",
        "Preview how the next lesson builds on this",
      ],
    });
  }

  return templates.slice(0, count);
}

function ensureRequiredKinds(lessons: LessonPlan[], modulePlan: ModulePlan): LessonPlan[] {
  if (!lessons.length) return buildFallbackLessonPlans(modulePlan);

  const has = (kind: CatalogLessonKind) => lessons.some((l) => l.lessonKind === kind);
  const fallback = buildFallbackLessonPlans(modulePlan);
  const next = [...lessons];

  const required: CatalogLessonKind[] = ["reading", "scenario", "assignment", "quiz"];
  for (const kind of required) {
    if (has(kind)) continue;
    const donor = fallback.find((l) => l.lessonKind === kind);
    if (donor) next.push(donor);
  }

  // Keep quiz last when present.
  const quiz = next.filter((l) => l.lessonKind === "quiz");
  const rest = next.filter((l) => l.lessonKind !== "quiz");
  return [...rest, ...quiz].slice(0, Math.max(modulePlan.lessonCount, 4));
}

async function requestLessonPlans(
  request: CatalogGenerationRequest,
  blueprint: Blueprint,
  modulePlan: ModulePlan,
  context: { index: number; total: number; previousTitles: string[] },
  options: { simplified: boolean; signal?: AbortSignal },
): Promise<LessonPlan[]> {
  const simplifiedRules = options.simplified
    ? `- Produce exactly ${modulePlan.lessonCount} lessons with short titles and 4-6 outline beats each.
- lessonKind must be one of: reading, scenario, assignment, quiz.
- Include one reading, one scenario, one assignment, and one closing quiz.
- Keep titles under 80 characters. Prefer simple wording.`
    : `- Produce exactly ${modulePlan.lessonCount} lessons.
- Each lesson needs: title, summary, lessonKind, learningObjectives, durationMinutes, outline (5-8 teaching beats).
- Each outline beat must be a teaching move (mechanism, example, mistake, decision) — not a topic label.
- lessonKind must be one of: reading, scenario, assignment, quiz, video, resource.
- Every module must include, in this order: at least one reading lesson, one scenario lesson, one assignment lesson, and a closing quiz lesson.
- The scenario lesson must apply the module's concepts to a realistic situation the learner works through.
- The assignment lesson must be a hands-on task that produces a deliverable graded by a rubric.
- Calibrate every lesson to ${blueprint.difficulty}: do not write beginner recap for intermediate/advanced, and do not skip scaffolding for beginner.
${request.source?.hasSource ? "- Lesson titles and outlines must teach SOURCE DOCUMENT concepts. Outline beats are teaching moves, not a finished lesson." : ""}`;

  const prompt = `Plan the lessons for one module.

COURSE: ${blueprint.title} (${blueprint.difficulty})
MODULE ${context.index + 1} of ${context.total}: ${modulePlan.title}
MODULE FOCUS: ${modulePlan.focus}
MODULE DESCRIPTION: ${modulePlan.description}
MODULE OBJECTIVES: ${modulePlan.learningObjectives.join("; ") || "—"}

PREVIOUS MODULES: ${context.previousTitles.join(", ") || "none"}

${briefBlock(request, blueprint)}

${calibrationBlock(blueprint.difficulty)}

Rules:
${simplifiedRules}

Return JSON only in this exact shape:
{ "lessons": [{ "title": string, "summary": string, "lessonKind": string, "learningObjectives": string[], "durationMinutes": number, "outline": string[] }] }

${jsonDiscipline()}`;

  const result = await generateJson<unknown>(DESIGNER_SYSTEM, prompt, {
    temperature: options.simplified ? 0.35 : 0.55,
    maxTokens: options.simplified ? 4500 : 8000,
    timeoutMs: options.simplified ? 70_000 : 90_000,
    signal: options.signal,
    label: options.simplified ? "lesson-plan-retry" : "lesson-plan",
  });

  return normalizeLessonPlans(extractLessonArray(result), modulePlan);
}

export async function generateModulePlan(
  request: CatalogGenerationRequest,
  blueprint: Blueprint,
  objectives: Objectives,
  signal?: AbortSignal,
): Promise<ModulePlan[]> {
  const prompt = `Design the module arc for this course.

${briefBlock(request, blueprint)}

COURSE: ${blueprint.title} — ${blueprint.subtitle}
IN SCOPE: ${blueprint.inScope.join("; ")}
OUT OF SCOPE: ${blueprint.outOfScope.join("; ") || "—"}

DOMAIN ANALYSIS:
${blueprint.domainAnalysis}

COURSE OBJECTIVES:
${objectives.learningObjectives.map((o, i) => `${i + 1}. ${o}`).join("\n")}

${calibrationBlock(blueprint.difficulty)}

Rules:
- Produce exactly ${request.moduleCount} modules — no more, no fewer.
- Quizzes and assignments are lessons inside those modules. Do NOT create extra modules for tests or a final exam.
- Every course objective must be served by at least one module.
- Sequence must respect dependencies.
- No filler "Introduction" or "Conclusion" modules.
- Each module needs lessonCount (${request.moduleCount === 1 ? "5-7" : "4-6"} lessons) so it can hold readings, a scenario, an assignment, and a closing quiz when needed.
- Keep each module title focused on one theme (avoid packing three topics into one title).
${request.source?.hasSource ? "- Module titles must follow the SOURCE DOCUMENT's headings/topics. Do not substitute a generic AI-course-generator outline." : ""}

Return JSON: { modules: [{ title, description, learningObjectives, lessonCount, focus }] }

${jsonDiscipline()}`;

  const result = await generateJson<{ modules: ModulePlan[] }>(DESIGNER_SYSTEM, prompt, {
    temperature: 0.7,
    maxTokens: 6000,
    signal,
  });

  const modules = result?.modules ?? [];
  if (!modules.length) throw new Error("Could not design the curriculum.");

  const normalized = modules.map((module, index) => ({
    title: module.title?.trim() || `Module ${index + 1}`,
    description: module.description?.trim() || "",
    learningObjectives: Array.isArray(module.learningObjectives)
      ? module.learningObjectives.map(String)
      : [],
    lessonCount: Math.min(
      7,
      Math.max(request.moduleCount === 1 ? 5 : 4, Number(module.lessonCount) || 4),
    ),
    focus: module.focus?.trim() || "",
  }));

  // Hard guarantee: exactly the Length the author selected.
  if (normalized.length >= request.moduleCount) {
    return normalized.slice(0, request.moduleCount);
  }

  while (normalized.length < request.moduleCount) {
    const index = normalized.length;
    normalized.push({
      title: `Module ${index + 1}`,
      description: `Continue the course toward objective ${index + 1}.`,
      learningObjectives: objectives.learningObjectives.slice(index, index + 1),
      lessonCount: request.moduleCount === 1 ? 6 : 4,
      focus: objectives.learningObjectives[index] || blueprint.inScope[index] || "",
    });
  }
  return normalized;
}

export async function generateLessonPlan(
  request: CatalogGenerationRequest,
  blueprint: Blueprint,
  modulePlan: ModulePlan,
  context: { index: number; total: number; previousTitles: string[] },
  signal?: AbortSignal,
): Promise<LessonPlan[]> {
  let lessons: LessonPlan[] = [];

  try {
    lessons = await requestLessonPlans(request, blueprint, modulePlan, context, {
      simplified: false,
      signal,
    });
  } catch (error) {
    if (signal?.aborted) throw error;
    console.warn(
      `[coursegen] lesson plan primary failed for "${modulePlan.title}":`,
      error instanceof Error ? error.message : error,
    );
  }

  if (!lessons.length) {
    try {
      lessons = await requestLessonPlans(request, blueprint, modulePlan, context, {
        simplified: true,
        signal,
      });
    } catch (error) {
      if (signal?.aborted) throw error;
      console.warn(
        `[coursegen] lesson plan retry failed for "${modulePlan.title}":`,
        error instanceof Error ? error.message : error,
      );
    }
  }

  if (!lessons.length) {
    console.warn(
      `[coursegen] using fallback lesson skeleton for "${modulePlan.title}"`,
    );
    lessons = buildFallbackLessonPlans(modulePlan);
  }

  return ensureRequiredKinds(lessons, modulePlan);
}
