"use server";

import { revalidatePath } from "next/cache";
import type { DeleteAdminCatalogProgramResult } from "./lib/programDeletion";

export type GenerateCatalogProgramInput = {
  prompt: string;
  length: string;
  difficulty: string;
  type: string;
};

export type GenerateCatalogProgramResult =
  | { ok: true; programId: string; programName: string }
  | { ok: false; reason: "unauthorized" | "invalid" | "failed"; message?: string };

export type CreateAdminProgramInput = {
  name: string;
  type: string;
  access: string;
  recognition: string;
  learningPath: string;
  credentialValidity?: string;
  category: string;
  description: string;
  price: string;
  /** Course topic tag ids (exactly 3 required). */
  tagIds: string[];
};

export type CreateAdminProgramResult =
  | { ok: true; programId: string }
  | { ok: false; reason: "unauthorized" | "invalid" | "failed"; message?: string };

export type WhitbyRefineContext = {
  focus?: "program" | "overview" | "module" | "lesson";
  moduleTitle?: string;
  lessonTitle?: string;
  moduleIndex?: number;
  lessonIndex?: number;
  /** Selected lesson type when focus is lesson */
  lessonType?: string;
  /** Short summary / excerpt for grounded chat + routing */
  lessonSummary?: string;
  lessonExcerpt?: string;
  /** Recent chat turns (client may send ~14); server keeps a sliding window + summary */
  recentChat?: { role: "user" | "whitby"; content: string }[];
};

export type RefineCatalogProgramResult =
  | {
      ok: true;
      mutated?: boolean;
      /** When true, nothing was changed yet — the change is waiting for [Apply]. */
      requiresApproval?: boolean;
      /** Token to confirm this exact previewed plan (pass back as confirmToken). */
      pendingToken?: string;
      /** Signed plan body — required on Vercel so Apply works on any instance. */
      pendingPayload?: string;
      /** Risk level of the previewed change. */
      risk?: "low" | "medium" | "high";
      /** Human-readable steps the instructor is being asked to approve. */
      plan?: string[];
      programName: string;
      summary: string;
      modules: {
        title: string;
        lessons: {
          title: string;
          type:
            | "reading"
            | "video"
            | "attachment"
            | "quiz"
            | "scenario"
            | "resource"
            | "assignment";
        }[];
      }[];
    }
  | { ok: false; reason: "unauthorized" | "invalid" | "failed"; message?: string };

export type SaveAdminCatalogDraftInput = {
  programId: string;
  name: string;
  description: string;
  category: string;
  type: string;
  access: string;
  recognition: string;
  learningPath: string;
  credentialValidity: string;
  price: string;
  coverImageUrl: string;
  prerequisiteProgramId: string;
  /** Course topic tag ids (exactly 3). */
  tagIds?: string[];
  /** Recreate modules/lessons from scratch. Used by Whitby undo — IDs are stale after a rewrite. */
  replaceStructure?: boolean;
  modules: {
    id?: string;
    title: string;
    lessons: {
      id?: string;
      title: string;
      type: string;
      contentUrl: string;
      contentBody: string;
      contentSummary: string;
      learningObjectives: string[];
      videoUrl: string;
      videoDurationSeconds: number;
      resources: {
        id?: string;
        title: string;
        resourceType: string;
        url: string;
        notes: string;
      }[];
      assignment: {
        id?: string;
        brief: string;
        submissionInstructions: string;
        rubric: string;
        estimatedMinutes: string;
      } | null;
      quiz: {
        id?: string;
        passingScore: string;
        questions: {
          id?: string;
          questionText: string;
          type: "multiple_choice" | "true_false";
          options: string[];
          correctAnswer: string;
        }[];
      } | null;
    }[];
  }[];
};

export type SaveAdminCatalogDraftResult =
  | { ok: true }
  | { ok: false; reason: "unauthorized" | "invalid" | "failed"; message?: string };

export type ToggleAdminCatalogPublishResult =
  | { ok: true; status: "draft" | "published" }
  | { ok: false; reason: "unauthorized" | "failed"; message?: string };

export async function generateCatalogProgramAction(
  input: GenerateCatalogProgramInput,
): Promise<GenerateCatalogProgramResult> {
  const { generateCatalogProgram } = await import("./services/generateCatalogProgram");
  const result = await generateCatalogProgram(input);
  if (result.ok) {
    revalidatePath("/academy/admin");
    revalidatePath("/academy/admin/programs");
    revalidatePath(`/academy/admin/catalog/${result.programId}`);
  }
  return result;
}

export async function createAdminProgramAction(
  input: CreateAdminProgramInput,
): Promise<CreateAdminProgramResult> {
  const { createAdminProgram } = await import("./services/createAdminProgram");
  const result = await createAdminProgram(input);
  if (result.ok) {
    revalidatePath("/academy/admin");
    revalidatePath("/academy/admin/programs");
    revalidatePath(`/academy/admin/catalog/${result.programId}`);
  }
  return result;
}

export async function refineCatalogProgramAction(
  programId: string,
  instruction: string,
  options?: {
    context?: WhitbyRefineContext;
    draft?: SaveAdminCatalogDraftInput;
    actionId?: string;
    confirmToken?: string;
    /** Sealed plan from the preview response — survives serverless instance hops. */
    confirmPayload?: string;
  },
): Promise<RefineCatalogProgramResult> {
  const { refineCatalogProgram } = await import("./services/refineCatalogProgram");
  const result = await refineCatalogProgram(programId, instruction, options);
  if (result.ok && result.mutated !== false) {
    revalidatePath("/academy/admin");
    revalidatePath("/academy/admin/programs");
    revalidatePath(`/academy/admin/catalog/${programId}`);
    revalidatePath(`/academy/admin/catalog/whitby-draft?id=${programId}`);
    revalidatePath("/academy/instructor");
    revalidatePath("/academy/instructor/programs");
    revalidatePath(`/academy/instructor/programs/${programId}`);
  }
  return result;
}

export async function saveAdminCatalogDraftAction(
  input: SaveAdminCatalogDraftInput,
): Promise<SaveAdminCatalogDraftResult> {
  const { saveAdminCatalogDraft } = await import("./services/saveAdminCatalogDraft");
  const result = await saveAdminCatalogDraft(input);
  if (result.ok) {
    revalidatePath(`/academy/explore/${input.programId}`);
    revalidatePath("/academy/admin/programs");
    revalidatePath(`/academy/instructor/programs/${input.programId}`);
  }
  return result;
}

export type SaveAdminCatalogCoverResult =
  | { ok: true }
  | { ok: false; reason: "unauthorized" | "failed"; message?: string };

export async function saveAdminCatalogCoverAction(
  programId: string,
  coverImageUrl: string,
): Promise<SaveAdminCatalogCoverResult> {
  const { saveAdminCatalogCover } = await import("./services/saveAdminCatalogCover");
  const result = await saveAdminCatalogCover(programId, coverImageUrl);
  if (result.ok) {
    revalidatePath("/academy/admin");
    revalidatePath("/academy/admin/programs");
    revalidatePath(`/academy/admin/catalog/${programId}`);
    revalidatePath("/academy/explore");
    revalidatePath(`/academy/explore/${programId}`);
    revalidatePath(`/academy/instructor/programs/${programId}`);
  }
  return result;
}

export async function publishAdminCatalogProgramAction(
  programId: string,
): Promise<ToggleAdminCatalogPublishResult> {
  const { publishAdminCatalogProgram } = await import("./services/toggleAdminCatalogPublish");
  const result = await publishAdminCatalogProgram(programId);
  if (result.ok) {
    revalidatePath("/academy/admin");
    revalidatePath("/academy/admin/programs");
    revalidatePath(`/academy/admin/catalog/${programId}`);
    revalidatePath("/academy/explore");
    revalidatePath(`/academy/explore/${programId}`);
  }
  return result;
}

export async function applyUnpublishedDraftAction(programId: string) {
  const { applyUnpublishedDraft } = await import("./services/applyUnpublishedDraft");
  const result = await applyUnpublishedDraft(programId);
  if (result.ok) {
    revalidatePath("/academy/admin");
    revalidatePath("/academy/admin/programs");
    revalidatePath(`/academy/admin/catalog/${programId}`);
    revalidatePath("/academy/explore");
    revalidatePath(`/academy/explore/${programId}`);
    revalidatePath(`/academy/instructor/programs/${programId}`);
  }
  return result;
}

export async function discardUnpublishedDraftAction(programId: string) {
  const { discardUnpublishedDraft } = await import("./services/discardUnpublishedDraft");
  const result = await discardUnpublishedDraft(programId);
  if (result.ok) {
    revalidatePath("/academy/admin");
    revalidatePath("/academy/admin/programs");
    revalidatePath(`/academy/admin/catalog/${programId}`);
    revalidatePath(`/academy/instructor/programs/${programId}`);
  }
  return result;
}

export async function unpublishAdminCatalogProgramAction(
  programId: string,
): Promise<ToggleAdminCatalogPublishResult> {
  const { unpublishAdminCatalogProgram } = await import("./services/toggleAdminCatalogPublish");
  const result = await unpublishAdminCatalogProgram(programId);
  if (result.ok) {
    revalidatePath("/academy/admin");
    revalidatePath("/academy/admin/programs");
    revalidatePath(`/academy/admin/catalog/${programId}`);
    revalidatePath("/academy");
    revalidatePath("/academy/explore");
    revalidatePath("/academy/learning");
    revalidatePath("/academy/credentials");
  }
  return result;
}

export async function loadCatalogProgramAction(programId: string) {
  const { loadCatalogProgram } = await import("./catalog/services/loadCatalogProgram");
  return loadCatalogProgram(programId);
}

export async function fillMissingLessonBodiesAction(programId: string) {
  const { fillMissingLessonBodies } = await import("./services/fillMissingLessonBodies");
  const result = await fillMissingLessonBodies(programId);
  if (result.ok && result.filled > 0) {
    revalidatePath(`/academy/admin/catalog/${programId}`);
    revalidatePath(`/academy/instructor/programs/${programId}`);
  }
  return result;
}

export async function parseCourseGenAttachmentAction(formData: FormData) {
  const { parseCourseGenAttachment } = await import("./services/parseCourseAttachment");
  return parseCourseGenAttachment(formData);
}

export async function deleteAdminCatalogProgramAction(
  programId: string,
): Promise<DeleteAdminCatalogProgramResult> {
  const { deleteAdminCatalogProgram } = await import("./services/deleteAdminCatalogProgram");
  const result = await deleteAdminCatalogProgram(programId);
  if (result.ok) {
    revalidatePath("/academy/admin");
    revalidatePath("/academy/admin/programs");
    revalidatePath(`/academy/admin/catalog/${programId}`);
  }
  return result;
}
