import "server-only";

import { createClient } from "@/base/lib/supabase/server";
import { getSessionProfile } from "@/base/identity/session";
import { canAccessAdminArea, isAcademyAdmin } from "@/academy/lib/authorization";
import type { ToggleAdminCatalogPublishResult } from "../actions";

async function setStatus(
  programId: string,
  status: "draft" | "published",
): Promise<ToggleAdminCatalogPublishResult> {
  try {
    const profile = await getSessionProfile();
    if (!profile) return { ok: false, reason: "unauthorized", message: "Sign in first." };

    const actor = { id: profile.user.id };
    const [area, admin] = await Promise.all([canAccessAdminArea(actor), isAcademyAdmin(actor)]);
    if (!area || !admin) {
      return { ok: false, reason: "unauthorized", message: "Admin access is required." };
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("academy_programs")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", programId)
      .select("id, status")
      .maybeSingle();

    if (error) {
      return {
        ok: false,
        reason: "failed",
        message: error.message.includes("approval")
          ? "Apply the latest Academy migrations so admins can publish from Catalog."
          : error.message,
      };
    }

    if (!data) {
      return { ok: false, reason: "failed", message: "The program was not updated." };
    }

    return { ok: true, status };
  } catch {
    return { ok: false, reason: "failed", message: "The program status could not be updated." };
  }
}

export async function publishAdminCatalogProgram(programId: string) {
  return setStatus(programId, "published");
}

export async function unpublishAdminCatalogProgram(programId: string) {
  return setStatus(programId, "draft");
}
