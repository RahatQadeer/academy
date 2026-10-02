import "server-only";

import { createClient, isSupabaseConfigured } from "@/base/lib/supabase/server";
import { getSessionProfile } from "@/base/identity/session";
import { canAccessAcademy, canAccessLearnerArea } from "@/academy/lib/authorization";
import { PROGRAM_ID } from "@/academy/lesson-player/utils/curriculum";
import type { AssignmentWriteResult } from "@/academy/assignments/types";
import { asAssignmentReason } from "./rpc";

const MAX_FILE_BYTES = 20 * 1024 * 1024;

function safeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 180);
}

export async function uploadAssignmentFile(file: File, assignmentId: string): Promise<
  | { ok: true; path: string; fileName: string }
  | { ok: false; reason: "invalid_file" | "unauthenticated" | "failed" }
> {
  if (!(file instanceof File) || file.size <= 0) {
    return { ok: false, reason: "invalid_file" };
  }
  if (file.size > MAX_FILE_BYTES) return { ok: false, reason: "invalid_file" };
  if (!PROGRAM_ID.test(assignmentId)) return { ok: false, reason: "invalid_file" };

  const profile = await getSessionProfile();
  if (!profile) return { ok: false, reason: "unauthenticated" };

  const supabase = await createClient();
  const fileName = safeFileName(file.name || "attachment");
  const path = `assignment-submissions/${profile.user.id}/${assignmentId}/${Date.now()}-${fileName}`;
  const { error } = await supabase.storage.from("academy").upload(path, file, { upsert: false });
  if (error) return { ok: false, reason: "failed" };
  return { ok: true, path, fileName };
}

export async function submitLearnerAssignment(input: {
  assignmentId: string;
  programId: string;
  lessonId: string;
  body: string;
  file?: File | null;
}): Promise<AssignmentWriteResult> {
  if (!isSupabaseConfigured()) return { status: "unavailable", reason: "failed" };
  if (
    !PROGRAM_ID.test(input.assignmentId) ||
    !PROGRAM_ID.test(input.programId) ||
    !PROGRAM_ID.test(input.lessonId)
  ) {
    return { status: "unavailable", reason: "not_found" };
  }

  const body = input.body.trim();

  const profile = await getSessionProfile();
  if (!profile) return { status: "unavailable", reason: "unauthenticated" };

  const user = { id: profile.user.id };
  if (!(await canAccessAcademy(user))) {
    return { status: "unavailable", reason: "no_academy_access" };
  }
  if (!(await canAccessLearnerArea(user))) {
    return { status: "unavailable", reason: "no_learner_capability" };
  }

  try {
    const supabase = await createClient();
    let filePath: string | null = null;
    let fileName: string | null = null;

    if (input.file && input.file.size > 0) {
      const uploaded = await uploadAssignmentFile(input.file, input.assignmentId);
      if (!uploaded.ok) return { status: "unavailable", reason: uploaded.reason };
      filePath = uploaded.path;
      fileName = uploaded.fileName;
    }

    const { data, error } = await supabase.rpc("academy_submit_assignment", {
      p_assignment_id: input.assignmentId,
      p_body: body,
      p_file_storage_path: filePath,
      p_file_name: fileName,
    });

    if (error) return { status: "unavailable", reason: "failed" };
    const payload = (typeof data === "string" ? JSON.parse(data) : data) as {
      status?: string;
      reason?: string;
    } | null;
    if (payload?.status !== "ok") {
      return { status: "unavailable", reason: asAssignmentReason(payload?.reason) };
    }
    return { status: "ok" };
  } catch {
    return { status: "unavailable", reason: "failed" };
  }
}

export async function saveLearnerAssignmentDraft(input: {
  assignmentId: string;
  body: string;
  file?: File | null;
}): Promise<AssignmentWriteResult> {
  if (!isSupabaseConfigured()) return { status: "unavailable", reason: "failed" };
  if (!PROGRAM_ID.test(input.assignmentId)) {
    return { status: "unavailable", reason: "not_found" };
  }

  const profile = await getSessionProfile();
  if (!profile) return { status: "unavailable", reason: "unauthenticated" };

  const user = { id: profile.user.id };
  if (!(await canAccessAcademy(user))) {
    return { status: "unavailable", reason: "no_academy_access" };
  }
  if (!(await canAccessLearnerArea(user))) {
    return { status: "unavailable", reason: "no_learner_capability" };
  }

  try {
    const supabase = await createClient();
    let filePath: string | null = null;
    let fileName: string | null = null;

    if (input.file && input.file.size > 0) {
      const uploaded = await uploadAssignmentFile(input.file, input.assignmentId);
      if (!uploaded.ok) return { status: "unavailable", reason: uploaded.reason };
      filePath = uploaded.path;
      fileName = uploaded.fileName;
    }

    const { data, error } = await supabase.rpc("academy_save_assignment_draft", {
      p_assignment_id: input.assignmentId,
      p_body: input.body.trim(),
      p_file_storage_path: filePath,
      p_file_name: fileName,
    });

    if (error) return { status: "unavailable", reason: "failed" };
    const payload = (typeof data === "string" ? JSON.parse(data) : data) as {
      status?: string;
      reason?: string;
    } | null;
    if (payload?.status !== "ok") {
      return { status: "unavailable", reason: asAssignmentReason(payload?.reason) };
    }
    return { status: "ok" };
  } catch {
    return { status: "unavailable", reason: "failed" };
  }
}
