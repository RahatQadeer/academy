import "server-only";

import { createClient } from "@/base/lib/supabase/server";
import { getSessionProfile } from "@/base/identity/session";
import {
  canAccessAdminArea,
  canAuthorProgram,
  isAcademyAdmin,
  isInstructor,
} from "@/academy/lib/authorization";
import { isUnpublishedDraftPayload } from "@/academy/lib/unpublishedDraft";

export type DiscardUnpublishedDraftResult =
  | { ok: true; discarded: boolean }
  | { ok: false; reason: "unauthorized" | "not_found" | "invalid" | "failed"; message?: string };

/**
 * Drop staged unpublished edits and return the editor to the live published curriculum.
 * Does not change academy_programs.status.
 */
export async function discardUnpublishedDraft(
  programId: string,
): Promise<DiscardUnpublishedDraftResult> {
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
    if (!isAdmin && !(instructor && author)) {
      return { ok: false, reason: "unauthorized" };
    }

    const supabase = await createClient();
    const { data: row, error } = await supabase
      .from("academy_programs")
      .select("id, status, unpublished_draft")
      .eq("id", programId)
      .maybeSingle();

    if (error) return { ok: false, reason: "failed", message: "Could not load the program." };
    if (!row) return { ok: false, reason: "not_found" };

    if ((row as { status?: string }).status !== "published") {
      return {
        ok: false,
        reason: "invalid",
        message: "Only published programs have a live version to revert to.",
      };
    }

    const hadDraft = isUnpublishedDraftPayload((row as { unpublished_draft?: unknown }).unpublished_draft);

    if (hadDraft) {
      const { error: clearError } = await supabase
        .from("academy_programs")
        .update({
          unpublished_draft: null,
          unpublished_draft_updated_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", programId)
        .eq("status", "published");

      if (clearError) {
        return {
          ok: false,
          reason: "failed",
          message: clearError.message.includes("unpublished_draft")
            ? "Apply migration 00041 so unpublished edits can be discarded."
            : "Could not discard unpublished edits.",
        };
      }

      // Drop pending/approved-but-not-applied republish requests tied to discarded edits.
      await supabase
        .from("academy_publish_requests")
        .update({
          status: "rejected",
          notes: "Unpublished edits were discarded. Submit again if needed.",
          reviewed_at: new Date().toISOString(),
          reviewed_by_admin_user_id: isAdmin ? profile.user.id : null,
        })
        .eq("program_id", programId)
        .in("status", ["pending", "approved"])
        .is("published_at", null);
    }

    return { ok: true, discarded: hadDraft };
  } catch {
    return { ok: false, reason: "failed", message: "Could not revert to the published version." };
  }
}
