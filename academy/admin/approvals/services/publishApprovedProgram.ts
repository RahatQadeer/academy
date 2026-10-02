import "server-only";

import { getSessionProfile } from "@/base/identity/session";
import { canAccessAdminArea, isAcademyAdmin } from "@/academy/lib/authorization";
import { publishProgram } from "@/academy/publish/services/publishProgram";
import type { ProgramPublicationResult } from "@/academy/publish/types";
import { UUID } from "../../types";
import { createClient } from "@/base/lib/supabase/server";

type RequestRow = { id: string; program_id: string; status: string };

export async function publishApprovedProgram(
  requestIdRaw: string,
): Promise<ProgramPublicationResult> {
  const requestId = requestIdRaw.trim().toLowerCase();
  if (!UUID.test(requestId)) {
    return { ok: false, reason: "not_found", message: "This request could not be found." };
  }

  try {
    const profile = await getSessionProfile();
    if (!profile) {
      return { ok: false, reason: "unauthenticated", message: "Sign in to publish this program." };
    }
    const actor = { id: profile.user.id };
    const [area, admin] = await Promise.all([canAccessAdminArea(actor), isAcademyAdmin(actor)]);
    if (!area || !admin) {
      return { ok: false, reason: "unauthorized", message: "You are not allowed to publish this program." };
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("academy_publish_requests")
      .select("id, program_id, status")
      .eq("id", requestId)
      .maybeSingle();
    if (error) return { ok: false, reason: "failed", message: "The program could not be published." };
    const row = data as RequestRow | null;
    if (!row) return { ok: false, reason: "not_found", message: "This request could not be found." };
    if (row.status !== "approved") {
      return {
        ok: false,
        reason: "not_approved",
        message: "An Academy Admin must approve this program before it can be published.",
      };
    }

    return publishProgram(row.program_id);
  } catch {
    return { ok: false, reason: "failed", message: "The program could not be published." };
  }
}
