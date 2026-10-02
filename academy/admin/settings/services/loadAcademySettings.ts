import "server-only";

import { cookies } from "next/headers";
import { getSessionProfile } from "@/base/identity/session";
import { canPerform } from "@/academy/lib/capabilities";
import { ACADEMY_SETTINGS_COOKIE, parseAcademySettings } from "../lib/defaults";
import type { AcademySettingsResult } from "../types";

export async function loadAcademySettings(): Promise<AcademySettingsResult> {
  try {
    const profile = await getSessionProfile();
    if (!profile) return { ok: false, reason: "unauthorized" };
    const actor = { id: profile.user.id };
    const allowed = await canPerform(actor, "settings.manage");
    if (!allowed) return { ok: false, reason: "unauthorized" };

    const canManageGlobal = await canPerform(actor, "settings.manage_global");
    const store = await cookies();
    return {
      ok: true,
      settings: parseAcademySettings(store.get(ACADEMY_SETTINGS_COOKIE)?.value),
      canManageGlobal,
    };
  } catch {
    return { ok: false, reason: "failed" };
  }
}
