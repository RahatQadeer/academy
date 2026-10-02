import "server-only";

import { createClient } from "@/base/lib/supabase/server";
import { getSessionProfile } from "@/base/identity/session";
import { canAccessAdminArea, canCreateCatalogProgram } from "@/academy/lib/authorization";
import type {
  GenerateCatalogProgramInput,
  GenerateCatalogProgramResult,
} from "../actions";
import { rewriteProgramDraft, type PersistedLesson, type PersistedModule, type PersistedProgramDraft } from "./catalogPersistence";
import { generateJson } from "./catalogPipeline/deepseek";
import { isProfessionalDraft, professionalDraftBrief } from "./catalogQuality";
import { stripQuizAnswerLeaks } from "@/academy/lib/quizQuestionText";

import { normalizeLegacyProgramType, toDbProgramType } from "@/academy/lib/courseMetadata";

const TYPE_MAP: Record<string, PersistedProgramDraft["type"]> = {
  "Short Course": "short_course",
  Course: "course",
  "Certification Program": "certification_program",
  "Endorsement Program": "endorsement_program",
  // Legacy CourseGen labels
  CPA: "certification_program",
  "Professional Practice Accelerator": "course",
  "Specialty Endorsement": "endorsement_program",
  "Special Endorsement": "endorsement_program",
  "Intelligent Coordination": "short_course",
  "Free Course": "course",
  "Paid Course": "course",
};

function sanitizeTitle(value: unknown, fallback: string) {
  const text = typeof value === "string" ? value.trim() : "";
  return text || fallback;
}

function sanitizeLessonType(value: unknown): PersistedLesson["type"] {
  if (
    value === "video" ||
    value === "attachment" ||
    value === "quiz" ||
    value === "scenario" ||
    value === "resource" ||
    value === "assignment"
  ) {
    return value;
  }
  return "reading";
}

function parseModelJson(content: string): PersistedProgramDraft | null {
  try {
    const raw = content.trim();
    const jsonLike =
      raw.startsWith("{") && raw.endsWith("}")
        ? raw
        : raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1);
    const parsed = JSON.parse(jsonLike) as Partial<
      PersistedProgramDraft & {
        modules: Array<
          PersistedModule & {
            lessons: Array<
              PersistedLesson & {
                resources?: {
                  title?: string;
                  resourceType?: string;
                  url?: string;
                  notes?: string;
                }[];
                assignment?: {
                  brief?: string;
                  submissionInstructions?: string;
                  rubric?: string;
                  estimatedMinutes?: string;
                } | null;
                quiz?: {
                  passingScore?: string;
                  questions?: {
                    questionText?: string;
                    type?: "multiple_choice" | "true_false";
                    options?: string[];
                    correctAnswer?: string;
                  }[];
                } | null;
              }
            >;
          }
        >;
      }
    >;
    const modules = Array.isArray(parsed.modules) ? parsed.modules : [];
    if (!parsed.name || modules.length === 0) return null;

    return {
      name: sanitizeTitle(parsed.name, "Untitled Program"),
      description: typeof parsed.description === "string" ? parsed.description.trim() : "",
      category: typeof parsed.category === "string" ? parsed.category.trim() : "",
      type: normalizeLegacyProgramType(
        typeof parsed.type === "string" ? parsed.type : "course",
      ),
      modules: modules
        .slice(0, 12)
        .map((module, moduleIndex) => {
          const item = module as Partial<PersistedModule & { lessons: PersistedLesson[] }>;
          const lessons = Array.isArray(item.lessons) ? item.lessons : [];
          return {
            title: sanitizeTitle(item.title, `Module ${moduleIndex + 1}`),
            lessons: lessons.slice(0, 10).map((lesson, lessonIndex) => {
              const lessonItem = lesson as Partial<
                PersistedLesson & {
                  resources?: {
                    title?: string;
                    resourceType?: string;
                    url?: string;
                    notes?: string;
                  }[];
                  assignment?: {
                    brief?: string;
                    submissionInstructions?: string;
                    rubric?: string;
                    estimatedMinutes?: string;
                  } | null;
                  quiz?: {
                    passingScore?: string;
                    questions?: {
                      questionText?: string;
                      type?: "multiple_choice" | "true_false";
                      options?: string[];
                      correctAnswer?: string;
                    }[];
                  } | null;
                }
              >;
              return {
                title: sanitizeTitle(lessonItem.title, `Lesson ${lessonIndex + 1}`),
                type: sanitizeLessonType(lessonItem.type),
                contentUrl: typeof lessonItem.contentUrl === "string" ? lessonItem.contentUrl.trim() : "",
                contentBody:
                  typeof lessonItem.contentBody === "string" ? lessonItem.contentBody.trim() : "",
                contentSummary:
                  typeof lessonItem.contentSummary === "string"
                    ? lessonItem.contentSummary.trim()
                    : "",
                learningObjectives: Array.isArray(lessonItem.learningObjectives)
                  ? lessonItem.learningObjectives.map((item) => String(item).trim()).filter(Boolean)
                  : [],
                videoUrl: typeof lessonItem.videoUrl === "string" ? lessonItem.videoUrl.trim() : "",
                videoDurationSeconds: 0,
                resources: Array.isArray(lessonItem.resources)
                  ? lessonItem.resources
                      .slice(0, 8)
                      .map((resource) => ({
                        title: sanitizeTitle(resource.title, "Resource"),
                        resourceType:
                          typeof resource.resourceType === "string" && resource.resourceType.trim()
                            ? resource.resourceType.trim()
                            : "link",
                        url: typeof resource.url === "string" ? resource.url.trim() : "",
                        notes: typeof resource.notes === "string" ? resource.notes.trim() : "",
                      }))
                  : [],
                assignment: lessonItem.assignment
                  ? {
                      brief:
                        typeof lessonItem.assignment.brief === "string"
                          ? lessonItem.assignment.brief.trim()
                          : "",
                      submissionInstructions:
                        typeof lessonItem.assignment.submissionInstructions === "string"
                          ? lessonItem.assignment.submissionInstructions.trim()
                          : "",
                      rubric:
                        typeof lessonItem.assignment.rubric === "string"
                          ? lessonItem.assignment.rubric.trim()
                          : "",
                      estimatedMinutes:
                        typeof lessonItem.assignment.estimatedMinutes === "string"
                          ? lessonItem.assignment.estimatedMinutes.trim()
                          : "",
                    }
                  : null,
                quiz: lessonItem.quiz
                  ? {
                      passingScore:
                        typeof lessonItem.quiz.passingScore === "string"
                          ? lessonItem.quiz.passingScore.trim()
                          : "80",
                      questions: Array.isArray(lessonItem.quiz.questions)
                        ? lessonItem.quiz.questions.slice(0, 20).map((question) => ({
                            questionText: stripQuizAnswerLeaks(
                              sanitizeTitle(question.questionText, "New question"),
                            ),
                            type:
                              question.type === "true_false"
                                ? ("true_false" as const)
                                : ("multiple_choice" as const),
                            options: Array.isArray(question.options)
                              ? question.options.map((option) => String(option)).filter(Boolean)
                              : [],
                            correctAnswer:
                              typeof question.correctAnswer === "string"
                                ? question.correctAnswer.trim()
                                : "",
                          }))
                        : [],
                    }
                  : null,
              };
            }),
          };
        })
        .filter((module) => module.lessons.length > 0),
    };
  } catch {
    return null;
  }
}

const DRAFT_SYSTEM =
  "You create Academy program drafts. Return only valid JSON with keys: name, description, category, type, modules. type must be one of short_course, course, certification_program, endorsement_program. modules must be an array of 3-8 modules. Each module must have title and lessons. Each lesson must have title, type, contentBody, contentSummary, learningObjectives, videoUrl, resources, assignment, quiz. Lesson type must be reading, video, attachment, quiz, scenario, resource, or assignment. Add quiz questions where suitable and assignment details when an assignment lesson exists.";

function draftUserPrompt(
  brief: string,
  input: GenerateCatalogProgramInput,
  preferredType: PersistedProgramDraft["type"],
  retry = false,
) {
  const retryNote = retry
    ? "\n\nThe last draft was too shallow. Expand lesson bodies substantially, strengthen assessments, and make the result feel publishable as a professional first draft."
    : "";

  return `${brief}${retryNote}

Create an Academy Admin course draft with these constraints:
- Prompt: ${input.prompt}
- Preferred length: ${input.length}
- Difficulty: ${input.difficulty}
- Preferred program type: ${preferredType}`;
}

async function buildProgramOutline(
  input: GenerateCatalogProgramInput,
): Promise<PersistedProgramDraft | null> {
  const preferredType = TYPE_MAP[input.type] ?? "course";
  const brief = professionalDraftBrief(input.prompt, input.length, input.difficulty, preferredType);

  const firstRaw = await generateJson<PersistedProgramDraft>(
    DRAFT_SYSTEM,
    draftUserPrompt(brief, input, preferredType),
    { temperature: 0.45 },
  );
  const firstPass = firstRaw ? normalizeDraft(firstRaw) : null;
  if (firstPass && isProfessionalDraft(firstPass)) {
    return firstPass;
  }

  const secondRaw = await generateJson<PersistedProgramDraft>(
    DRAFT_SYSTEM,
    draftUserPrompt(brief, input, preferredType, true),
    { temperature: 0.45 },
  );
  const secondPass = secondRaw ? normalizeDraft(secondRaw) : null;
  return secondPass && isProfessionalDraft(secondPass) ? secondPass : firstPass;
}

function normalizeDraft(raw: PersistedProgramDraft): PersistedProgramDraft | null {
  return parseModelJson(JSON.stringify(raw));
}

export async function generateCatalogProgram(
  input: GenerateCatalogProgramInput,
): Promise<GenerateCatalogProgramResult> {
  try {
    const profile = await getSessionProfile();
    if (!profile) return { ok: false, reason: "unauthorized" };

    const actor = { id: profile.user.id };
    const [area, canCreate] = await Promise.all([
      canAccessAdminArea(actor),
      canCreateCatalogProgram(actor),
    ]);
    if (!area || !canCreate) return { ok: false, reason: "unauthorized" };

    const prompt = input.prompt.trim();
    if (!prompt) {
      return { ok: false, reason: "invalid", message: "Add a prompt before generating." };
    }

    const draft = await buildProgramOutline(input);
    if (!draft || draft.modules.length === 0) {
      return { ok: false, reason: "failed", message: "Whitby could not generate a usable outline." };
    }

    const supabase = await createClient();
    const programType = toDbProgramType(draft.type);
    const { data: createdProgram, error: programError } = await supabase
      .from("academy_programs")
      .insert({
        name: draft.name,
        type: programType,
        category: draft.category || input.type,
        description: draft.description || prompt,
        status: "draft",
        created_by_user_id: profile.user.id,
      })
      .select("id")
      .maybeSingle();

    if (programError || !createdProgram) {
      return { ok: false, reason: "failed", message: "The program draft could not be created." };
    }

    const programId = (createdProgram as { id: string }).id;

    const persisted = await rewriteProgramDraft(supabase, programId, draft);
    if (!persisted.ok) {
      return { ok: false, reason: "failed", message: "The generated course content could not be saved." };
    }

    const { writeProgramContentSnapshot } = await import("@/academy/lib/programContentSnapshot");
    await writeProgramContentSnapshot({
      programId,
      actorUserId: profile.user.id,
      supabase,
    });

    return { ok: true, programId, programName: draft.name };
  } catch {
    return { ok: false, reason: "failed", message: "Whitby could not generate the course draft." };
  }
}
