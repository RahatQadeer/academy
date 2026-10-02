import type { CatalogLesson, CatalogModule, CatalogProgramDetail } from "@/academy/admin/catalog/types";
import { isAcademyProgramType } from "@/academy/lib/domain";
import type { EditorLesson, EditorModule, EditorProgram, SaveProgramDraftInput } from "../types";

export function editorLessonToCatalog(lesson: EditorLesson): CatalogLesson {
  return {
    id: lesson.id,
    title: lesson.title,
    type: lesson.type,
    contentUrl: lesson.contentUrl,
    contentBody: lesson.contentBody,
    contentSummary: lesson.contentSummary,
    learningObjectives: lesson.learningObjectives,
    videoUrl: lesson.videoUrl,
    videoDurationSeconds: lesson.videoDurationSeconds,
    sortOrder: lesson.sortOrder,
    resources: lesson.resources.map((resource) => ({
      id: resource.id,
      title: resource.title,
      resourceType: resource.resourceType,
      url: resource.url,
      notes: resource.notes,
      sortOrder: resource.sortOrder,
    })),
    assignment: lesson.assignment
      ? {
          id: lesson.assignment.id,
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
            id: question.id,
            questionText: question.questionText,
            type: question.type,
            options: question.options,
            correctAnswer: question.correctAnswer,
            sortOrder: question.sortOrder,
            fromBank: question.fromBank,
          })),
        }
      : null,
  };
}

export function editorModuleToCatalog(module: EditorModule): CatalogModule {
  return {
    id: module.id,
    title: module.title,
    sortOrder: module.sortOrder,
    lessons: module.lessons.map(editorLessonToCatalog),
  };
}

export function editorProgramToCatalog(program: EditorProgram): CatalogProgramDetail {
  return {
    id: program.id,
    name: program.name,
    description: program.description,
    category: program.category,
    type: program.type,
    access: program.access,
    recognition: program.recognition,
    learningPath: program.learningPath,
    credentialValidity: program.credentialValidity,
    price: program.price,
    status: program.status,
    enrollmentCount: 0,
    activeEnrollmentCount: 0,
    coverImageUrl: program.coverImageUrl,
    prerequisiteProgramId: program.prerequisiteProgramId,
    prerequisites: program.prerequisites,
    latestRequestStatus: program.latestRequestStatus,
    canPublishWithoutApproval: program.canPublishWithoutApproval,
    hasUnpublishedChanges: program.hasUnpublishedChanges,
    tagIds: program.tagIds ?? [],
    modules: program.modules.map(editorModuleToCatalog),
  };
}

export function catalogLessonToEditor(
  lesson: CatalogLesson,
  previous?: EditorLesson,
): EditorLesson {
  return {
    id: lesson.id,
    title: lesson.title,
    type: lesson.type,
    contentUrl: lesson.contentUrl,
    contentBody: lesson.contentBody,
    contentSummary: lesson.contentSummary,
    learningObjectives: lesson.learningObjectives,
    videoUrl: lesson.videoUrl,
    videoDurationSeconds: lesson.videoDurationSeconds,
    sortOrder: lesson.sortOrder,
    resources: lesson.resources.map((resource, index) => ({
      id: resource.id,
      title: resource.title,
      resourceType: resource.resourceType,
      url: resource.url,
      notes: resource.notes,
      sortOrder: resource.sortOrder ?? index,
    })),
    assignment: lesson.assignment
      ? {
          id: lesson.assignment.id,
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
          questions: lesson.quiz.questions.map((question, index) => ({
            id: question.id,
            questionText: question.questionText,
            type: question.type,
            options: question.options,
            correctAnswer: question.correctAnswer,
            sortOrder: question.sortOrder ?? index,
            fromBank: question.fromBank,
          })),
        }
      : null,
    quizId: lesson.quiz?.id ?? previous?.quizId ?? null,
  };
}

export function applyCatalogToEditor(
  editor: EditorProgram,
  catalog: CatalogProgramDetail,
): EditorProgram {
  return {
    ...editor,
    name: catalog.name,
    description: catalog.description,
    category: catalog.category,
    type: isAcademyProgramType(catalog.type) ? catalog.type : editor.type,
    access: (catalog.access as EditorProgram["access"]) ?? editor.access,
    recognition: (catalog.recognition as EditorProgram["recognition"]) ?? editor.recognition,
    learningPath: (catalog.learningPath as EditorProgram["learningPath"]) ?? editor.learningPath,
    credentialValidity:
      (catalog.credentialValidity as EditorProgram["credentialValidity"]) ??
      editor.credentialValidity,
    status: catalog.status,
    coverImageUrl: catalog.coverImageUrl,
    prerequisiteProgramId: catalog.prerequisiteProgramId ?? editor.prerequisiteProgramId,
    tagIds: catalog.tagIds ?? editor.tagIds,
    modules: catalog.modules.map((module, moduleIndex) => ({
      id: module.id,
      title: module.title,
      sortOrder: module.sortOrder ?? moduleIndex,
      lessons: module.lessons.map((lesson, lessonIndex) =>
        catalogLessonToEditor(lesson, editor.modules[moduleIndex]?.lessons[lessonIndex]),
      ),
    })),
  };
}

export function buildInstructorDraftPayload(program: EditorProgram): SaveProgramDraftInput {
  return {
    programId: program.id,
    name: program.name,
    type: program.type,
    access: program.access,
    recognition: program.recognition,
    learningPath: program.learningPath,
    credentialValidity: program.credentialValidity,
    category: program.category,
    description: program.description,
    prerequisiteProgramId: program.prerequisiteProgramId,
    price: program.price,
    coverImageUrl: program.coverImageUrl,
    tagIds: program.tagIds ?? [],
    modules: program.modules.map((module) => ({
      id: module.id || null,
      title: module.title,
      lessons: module.lessons.map((lesson) => ({
        id: lesson.id || null,
        title: lesson.title,
        type: lesson.type,
        contentUrl: lesson.contentUrl,
        contentBody: lesson.contentBody,
        contentSummary: lesson.contentSummary,
        learningObjectives: lesson.learningObjectives,
        videoUrl: lesson.videoUrl,
        videoDurationSeconds: lesson.videoDurationSeconds,
        resources: lesson.resources.map((resource) => ({
          id: resource.id || null,
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
              passingScore: lesson.quiz.passingScore,
              questions: lesson.quiz.questions.map((question) => ({
                id: question.id || null,
                questionText: question.questionText,
                type: question.type,
                options: question.options,
                correctAnswer: question.correctAnswer,
                fromBank: question.fromBank,
              })),
            }
          : null,
      })),
    })),
  };
}

export function instructorDraftSnapshot(program: EditorProgram) {
  return JSON.stringify(buildInstructorDraftPayload(program));
}
