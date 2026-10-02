import type { PersistedModule, PersistedProgramDraft } from "@/academy/admin/services/catalogPersistence";
import type { CatalogModule, CatalogProgramDetail } from "@/academy/admin/catalog/types";
import type { EditorModule, EditorProgram } from "@/academy/instructor/programs/types";

export const UNPUBLISHED_DRAFT_VERSION = 1 as const;

/** Stored on academy_programs.unpublished_draft while status = published. */
export type UnpublishedDraftPayload = {
  version: typeof UNPUBLISHED_DRAFT_VERSION;
  name: string;
  description: string;
  category: string;
  type: string;
  access?: string;
  recognition?: string;
  learningPath?: string;
  credentialValidity?: string;
  price: string;
  coverImageUrl: string;
  prerequisiteProgramId?: string;
  replaceStructure?: boolean;
  /** Course topic tag ids (exactly 3). */
  tagIds?: string[];
  modules: PersistedModule[];
};

export function isUnpublishedDraftPayload(value: unknown): value is UnpublishedDraftPayload {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return row.version === UNPUBLISHED_DRAFT_VERSION && Array.isArray(row.modules);
}

export function toPersistedProgramDraft(payload: UnpublishedDraftPayload): PersistedProgramDraft {
  return {
    name: payload.name,
    description: payload.description,
    category: payload.category,
    type: payload.type,
    modules: payload.modules,
  };
}

function newId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function modulesFromDraft(modules: PersistedModule[]): CatalogModule[] {
  return modules.map((module, moduleIndex) => {
    const moduleId = module.id?.trim() || newId();
    return {
      id: moduleId,
      title: module.title,
      sortOrder: moduleIndex,
      lessons: module.lessons.map((lesson, lessonIndex) => {
        const lessonId = lesson.id?.trim() || newId();
        return {
          id: lessonId,
          title: lesson.title,
          type: lesson.type,
          contentUrl: lesson.contentUrl,
          contentBody: lesson.contentBody,
          contentSummary: lesson.contentSummary,
          learningObjectives: lesson.learningObjectives,
          videoUrl: lesson.videoUrl,
          videoDurationSeconds: lesson.videoDurationSeconds ?? 0,
          sortOrder: lessonIndex,
          resources: lesson.resources.map((resource, resourceIndex) => ({
            id: newId(),
            title: resource.title,
            resourceType: resource.resourceType,
            url: resource.url,
            notes: resource.notes,
            sortOrder: resourceIndex,
          })),
          assignment: lesson.assignment
            ? {
                id: newId(),
                brief: lesson.assignment.brief,
                submissionInstructions: lesson.assignment.submissionInstructions,
                rubric: lesson.assignment.rubric,
                estimatedMinutes: lesson.assignment.estimatedMinutes,
              }
            : null,
          quiz: lesson.quiz
            ? {
                id: lesson.quiz.id?.trim() || newId(),
                passingScore: lesson.quiz.passingScore,
                questions: lesson.quiz.questions.map((question, questionIndex) => ({
                  id: newId(),
                  questionText: question.questionText,
                  type: question.type,
                  options: question.options,
                  correctAnswer: question.correctAnswer,
                  sortOrder: questionIndex,
                })),
              }
            : null,
        };
      }),
    };
  });
}

export function applyUnpublishedDraftToCatalog(
  program: CatalogProgramDetail,
  draft: UnpublishedDraftPayload,
): CatalogProgramDetail {
  return {
    ...program,
    name: draft.name,
    description: draft.description,
    category: draft.category,
    type: draft.type,
    access: draft.access ?? program.access,
    recognition: draft.recognition ?? program.recognition,
    learningPath: draft.learningPath ?? program.learningPath,
    credentialValidity: draft.credentialValidity ?? program.credentialValidity,
    price: draft.price,
    coverImageUrl: draft.coverImageUrl,
    prerequisiteProgramId: draft.prerequisiteProgramId ?? program.prerequisiteProgramId,
    tagIds: draft.tagIds ?? program.tagIds,
    modules: modulesFromDraft(draft.modules),
    hasUnpublishedChanges: true,
  };
}

export function applyUnpublishedDraftToEditor(
  program: EditorProgram,
  draft: UnpublishedDraftPayload,
): EditorProgram {
  const modules = modulesFromDraft(draft.modules) as unknown as EditorModule[];
  return {
    ...program,
    name: draft.name,
    description: draft.description,
    category: draft.category,
    type: draft.type as EditorProgram["type"],
    access: (draft.access as EditorProgram["access"]) ?? program.access,
    recognition: (draft.recognition as EditorProgram["recognition"]) ?? program.recognition,
    learningPath: (draft.learningPath as EditorProgram["learningPath"]) ?? program.learningPath,
    credentialValidity:
      (draft.credentialValidity as EditorProgram["credentialValidity"]) ?? program.credentialValidity,
    price: draft.price,
    coverImageUrl: draft.coverImageUrl,
    prerequisiteProgramId: draft.prerequisiteProgramId ?? program.prerequisiteProgramId,
    tagIds: draft.tagIds ?? program.tagIds,
    modules,
    hasUnpublishedChanges: true,
  };
}

export function catalogModulesToPersisted(modules: CatalogProgramDetail["modules"]): PersistedModule[] {
  return modules.map((module) => ({
    id: module.id,
    title: module.title,
    lessons: module.lessons.map((lesson) => ({
      id: lesson.id,
      title: lesson.title,
      type: lesson.type,
      contentUrl: lesson.contentUrl,
      contentBody: lesson.contentBody,
      contentSummary: lesson.contentSummary,
      learningObjectives: lesson.learningObjectives,
      videoUrl: lesson.videoUrl,
      videoDurationSeconds: lesson.videoDurationSeconds ?? 0,
      resources: lesson.resources.map((resource) => ({
        title: resource.title,
        resourceType: resource.resourceType,
        url: resource.url,
        notes: resource.notes,
      })),
      assignment: lesson.assignment
        ? {
            brief: lesson.assignment.brief,
            submissionInstructions: lesson.assignment.submissionInstructions,
            rubric: lesson.assignment.rubric,
            estimatedMinutes: lesson.assignment.estimatedMinutes,
          }
        : null,
      quiz: lesson.quiz
        ? {
            id: lesson.quiz.id,
            passingScore: lesson.quiz.passingScore,
            questions: lesson.quiz.questions.map((question) => ({
              questionText: question.questionText,
              type: question.type,
              options: question.options,
              correctAnswer: question.correctAnswer,
            })),
          }
        : null,
    })),
  }));
}
