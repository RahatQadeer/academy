import "server-only";

import { createClient } from "@/base/lib/supabase/server";
import { authorizeCatalogAuthor } from "./authorizeCatalogAuthor";
import {
  isUnpublishedDraftPayload,
  type UnpublishedDraftPayload,
} from "@/academy/lib/unpublishedDraft";

export type SaveAdminCatalogCoverResult =
  | { ok: true }
  | { ok: false; reason: "unauthorized" | "failed"; message?: string };

export async function saveAdminCatalogCover(
  programId: string,
  coverImageUrl: string,
): Promise<SaveAdminCatalogCoverResult> {
  try {
    const auth = await authorizeCatalogAuthor(programId);
    if (!auth.ok) return { ok: false, reason: "unauthorized" };

    const supabase = await createClient();
    const { data: current } = await supabase
      .from("academy_programs")
      .select("status, unpublished_draft, name, description, category, type, price, cover_image_url")
      .eq("id", programId)
      .maybeSingle();

    const row = current as
      | {
          status?: string;
          unpublished_draft?: unknown;
          name?: string;
          description?: string | null;
          category?: string | null;
          type?: string;
          price?: number | string | null;
          cover_image_url?: string | null;
        }
      | null;

    if (!auth.isAdmin && row?.status === "published") {
      // Instructors may stage cover on live programs via unpublished draft.
    }

    if (row?.status === "published") {
      const nextCover = coverImageUrl.trim();
      let draft: UnpublishedDraftPayload;
      if (isUnpublishedDraftPayload(row.unpublished_draft)) {
        draft = { ...row.unpublished_draft, coverImageUrl: nextCover };
      } else {
        // Seed draft from live metadata + empty modules so cover alone can stage.
        // Full curriculum still comes from live until first content save.
        const { data: modules } = await supabase
          .from("academy_modules")
          .select("id, title, sort_order")
          .eq("program_id", programId)
          .order("sort_order", { ascending: true });
        // Prefer requiring a content save first — simpler: if no draft, write live cover for admin only.
        if (!auth.isAdmin) {
          return {
            ok: false,
            reason: "failed",
            message: "Save program edits first, then change the cover — or ask an admin.",
          };
        }
        // Admin changing cover only on published without draft: keep live cover (immediate)
        // so explore cards update; unpublished content edits still use draft path.
        void modules;
        const { error: liveCoverError } = await supabase
          .from("academy_programs")
          .update({ cover_image_url: nextCover || null })
          .eq("id", programId);
        if (liveCoverError) {
          return { ok: false, reason: "failed", message: "The cover image could not be saved." };
        }
        return { ok: true };
      }

      const { error: draftError } = await supabase
        .from("academy_programs")
        .update({
          unpublished_draft: draft,
          unpublished_draft_updated_at: new Date().toISOString(),
        })
        .eq("id", programId)
        .eq("status", "published");

      if (draftError) {
        return {
          ok: false,
          reason: "failed",
          message: draftError.message.includes("unpublished_draft")
            ? "Apply migration 00041 so unpublished edits can be saved."
            : "The cover image could not be saved.",
        };
      }
      return { ok: true };
    }

    let update = supabase
      .from("academy_programs")
      .update({ cover_image_url: coverImageUrl.trim() || null })
      .eq("id", programId);
    if (!auth.isAdmin) update = update.neq("status", "published");
    const { error } = await update;

    if (error) {
      return {
        ok: false,
        reason: "failed",
        message: error.message.includes("cover_image_url")
          ? "Cover column missing — run migration 00022 on Supabase."
          : "The cover image could not be saved.",
      };
    }

    return { ok: true };
  } catch {
    return { ok: false, reason: "failed", message: "The cover image could not be saved." };
  }
}
