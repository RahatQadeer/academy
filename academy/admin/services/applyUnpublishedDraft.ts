import "server-only";

import { createClient } from "@/base/lib/supabase/server";
import { getSessionProfile } from "@/base/identity/session";
import {
  canAccessAdminArea,
  canAuthorProgram,
  canPublishProgram,
  isAcademyAdmin,
  isInstructor,
} from "@/academy/lib/authorization";
import { rewriteProgramDraft, syncProgramDraft } from "@/academy/admin/services/catalogPersistence";
import { parsePrice, parseProgramType, validateProgramName } from "@/academy/instructor/programs/utils/validation";
import {
  coerceAccess,
  coerceCredentialValidity,
  coerceLearningPath,
  coerceRecognitionForType,
} from "@/academy/lib/courseMetadata";
import {
  isUnpublishedDraftPayload,
  toPersistedProgramDraft,
  type UnpublishedDraftPayload,
} from "@/academy/lib/unpublishedDraft";

export type ApplyUnpublishedDraftResult =
  | { ok: true }
  | { ok: false; reason: "unauthorized" | "not_found" | "invalid" | "failed"; message?: string };

/**
 * Promote staged unpublished_draft onto live curriculum rows and clear the draft.
 * Keeps academy_programs.status = published.
 */
export async function applyUnpublishedDraft(
  programId: string,
  options?: { requirePublishPermission?: boolean },
): Promise<ApplyUnpublishedDraftResult> {
  try {
    const profile = await getSessionProfile();
    if (!profile) return { ok: false, reason: "unauthorized" };
    const actor = { id: profile.user.id };

    const [adminArea, admin, instructor, author] = await Promise.all([
      canAccessAdminArea(actor),
      isAcademyAdmin(actor),
      isInstructor(actor),
      canAuthorProgram(actor, programId),
    ]);

    const isAdmin = Boolean(adminArea && admin);
    if (!isAdmin) {
      if (!instructor || !author) return { ok: false, reason: "unauthorized" };
      if (options?.requirePublishPermission !== false) {
        if (!(await canPublishProgram(actor, programId))) {
          return {
            ok: false,
            reason: "unauthorized",
            message: "An Academy Admin must approve these changes before they go live.",
          };
        }
      }
    }

    const supabase = await createClient();
    const { data: row, error } = await supabase
      .from("academy_programs")
      .select("id, status, unpublished_draft")
      .eq("id", programId)
      .maybeSingle();

    if (error) return { ok: false, reason: "failed", message: "Could not load the program." };
    if (!row) return { ok: false, reason: "not_found" };

    const status = (row as { status?: string }).status;
    if (status !== "published") {
      return { ok: false, reason: "invalid", message: "Only published programs use staged changes." };
    }

    const raw = (row as { unpublished_draft?: unknown }).unpublished_draft;
    if (!isUnpublishedDraftPayload(raw)) {
      return { ok: false, reason: "invalid", message: "There are no unpublished edits to publish." };
    }

    const draft = raw as UnpublishedDraftPayload;
    const name = validateProgramName(draft.name);
    const type = parseProgramType(draft.type);
    const price = parsePrice(draft.price);
    if (!name || !type || !price.ok) {
      return { ok: false, reason: "invalid", message: "Fix the draft title, type, or price before publishing." };
    }

    const access = coerceAccess(draft.access, type);
    const recognition = coerceRecognitionForType(type, draft.recognition);
    const learningPath = coerceLearningPath(draft.learningPath, type);
    const credentialValidity = coerceCredentialValidity(
      draft.credentialValidity,
      type,
      recognition,
    );

    const { error: metaError } = await supabase
      .from("academy_programs")
      .update({
        name,
        description: draft.description.trim() || null,
        category: draft.category.trim() || null,
        type,
        access,
        recognition,
        learning_path: learningPath,
        credential_validity: credentialValidity,
        price: price.value,
        cover_image_url: draft.coverImageUrl.trim() || null,
        ...(draft.prerequisiteProgramId !== undefined
          ? {
              prerequisite_program_id: draft.prerequisiteProgramId.trim() || null,
            }
          : null),
        updated_at: new Date().toISOString(),
      })
      .eq("id", programId)
      .eq("status", "published");

    if (metaError) {
      return { ok: false, reason: "failed", message: "Program details could not be updated." };
    }

    try {
      await supabase.rpc("academy_sync_program_credential_types", {
        p_program_id: programId,
      });
    } catch {
      /* RPC available after migration 00057 */
    }

    const persisted = toPersistedProgramDraft(draft);
    const persist = draft.replaceStructure
      ? await rewriteProgramDraft(supabase, programId, persisted)
      : await syncProgramDraft(supabase, programId, persisted);

    if (!persist.ok) {
      return { ok: false, reason: "failed", message: "Live curriculum could not be updated." };
    }

    const { error: clearError } = await supabase
      .from("academy_programs")
      .update({
        unpublished_draft: null,
        unpublished_draft_updated_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", programId);

    if (clearError) {
      return { ok: false, reason: "failed", message: "Changes went live but the draft flag could not clear." };
    }

    // Stamp latest approved request as published when present.
    const { data: approved } = await supabase
      .from("academy_publish_requests")
      .select("id")
      .eq("program_id", programId)
      .eq("status", "approved")
      .is("published_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (approved && (approved as { id?: string }).id) {
      await supabase
        .from("academy_publish_requests")
        .update({
          published_at: new Date().toISOString(),
          published_by_user_id: profile.user.id,
        })
        .eq("id", (approved as { id: string }).id);
    }

    const { writeProgramContentSnapshot } = await import("@/academy/lib/programContentSnapshot");
    await writeProgramContentSnapshot({
      programId,
      actorUserId: profile.user.id,
      supabase,
    });

    return { ok: true };
  } catch {
    return { ok: false, reason: "failed", message: "Unpublished edits could not be published." };
  }
}
