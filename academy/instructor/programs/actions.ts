"use server";

import { revalidatePath } from "next/cache";
import type {
  CreateProgramInput,
  CreateProgramResult,
  SaveProgramDraftInput,
  SaveProgramDraftResult,
  SubmitPublishResult,
} from "./types";

export async function createProgramAction(input: CreateProgramInput): Promise<CreateProgramResult> {
  const { createProgram } = await import("./services/createProgram");
  const result = await createProgram(input);
  if (result.ok) {
    revalidatePath("/academy/instructor");
    revalidatePath("/academy/instructor/programs");
    revalidatePath(`/academy/instructor/programs/${result.programId}`);
  }
  return result;
}

export async function saveProgramDraftAction(
  input: SaveProgramDraftInput,
): Promise<SaveProgramDraftResult> {
  const { saveProgramDraft } = await import("./services/saveProgramDraft");
  const result = await saveProgramDraft(input);
  if (result.ok) {
    revalidatePath("/academy/instructor");
    revalidatePath("/academy/instructor/programs");
  }
  return result;
}

export async function submitPublishRequestAction(programId: string): Promise<SubmitPublishResult> {
  const { submitPublishRequest } = await import("./services/submitPublishRequest");
  const result = await submitPublishRequest(programId);
  if (result.ok) {
    revalidatePath("/academy/instructor");
    revalidatePath("/academy/instructor/programs");
    revalidatePath(`/academy/instructor/programs/${programId}`);
    revalidatePath("/academy/admin");
    revalidatePath("/academy/admin/approvals");
  }
  return result;
}

export async function publishProgramAction(programId: string) {
  const { publishProgram } = await import("./services/publishProgram");
  const result = await publishProgram(programId);
  if (result.ok) {
    revalidatePath("/academy/instructor");
    revalidatePath("/academy/instructor/programs");
    revalidatePath(`/academy/instructor/programs/${programId}`);
    revalidatePath("/academy/explore");
    revalidatePath("/academy/admin");
    revalidatePath("/academy/admin/approvals");
  }
  return result;
}

export async function saveProgramCoverAction(programId: string, coverImageUrl: string) {
  const { saveProgramCover } = await import("./services/saveProgramCover");
  const result = await saveProgramCover(programId, coverImageUrl);
  if (result.ok) {
    revalidatePath(`/academy/instructor/programs/${programId}`);
  }
  return result;
}

export async function loadProgramEditorAction(programId: string) {
  const { getSessionProfile } = await import("@/base/identity/session");
  const { loadProgramEditor } = await import("./services/loadProgramEditor");
  const profile = await getSessionProfile();
  if (!profile) return { ok: false as const, reason: "unauthorized" as const };
  return loadProgramEditor(profile.user.id, programId);
}
