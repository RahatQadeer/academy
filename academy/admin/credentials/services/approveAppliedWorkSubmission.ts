import "server-only";

import { createClient } from "@/base/lib/supabase/server";
import { getSessionProfile } from "@/base/identity/session";
import { canAccessAdminArea, isAcademyAdmin } from "@/academy/lib/authorization";

export async function approveAppliedWorkSubmission(
  submissionId: string,
): Promise<{ ok: boolean }> {
  try {
    const profile = await getSessionProfile();
    if (!profile) return { ok: false };
    const actor = { id: profile.user.id };
    const [area, admin] = await Promise.all([canAccessAdminArea(actor), isAcademyAdmin(actor)]);
    if (!area || !admin) return { ok: false };

    const supabase = await createClient();
    const { data, error } = await supabase.rpc("academy_approve_applied_work_submission", {
      p_submission_id: submissionId,
    });
    if (error) return { ok: false };
    const payload = data as { status?: string } | null;
    return { ok: payload?.status === "ok" };
  } catch {
    return { ok: false };
  }
}
