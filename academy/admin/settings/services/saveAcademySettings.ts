import "server-only";

import { cookies } from "next/headers";
import { getSessionProfile } from "@/base/identity/session";
import { canPerform } from "@/academy/lib/capabilities";
import {
  ACADEMY_AUDIT_ENTITY_SETTINGS,
  ACADEMY_SETTINGS_ENTITY_ID,
  writeAcademyAdminAudit,
} from "@/academy/lib/adminAudit";
import {
  ACADEMY_SETTINGS_COOKIE,
  DEFAULT_ACADEMY_SETTINGS,
  isIdentityProvider,
  parseAcademySettings,
} from "../lib/defaults";
import {
  mergeAcademySettingsForSave,
  superAdminSettingsChanged,
} from "../lib/keys";
import type { AcademyAdminSettings, SaveAcademySettingsResult } from "../types";

function normalize(input: AcademyAdminSettings): AcademyAdminSettings {
  return {
    instructorPublishApproval: Boolean(input.instructorPublishApproval),
    whitbyAssistedDrafting: Boolean(input.whitbyAssistedDrafting),
    identityProvider: isIdentityProvider(input.identityProvider)
      ? input.identityProvider
      : DEFAULT_ACADEMY_SETTINGS.identityProvider,
    credentialExpirationNotices: Boolean(input.credentialExpirationNotices),
    customCourseTags: Array.isArray(input.customCourseTags)
      ? input.customCourseTags
          .filter((item): item is string => typeof item === "string")
          .map((item) => item.trim())
          .filter(Boolean)
      : [],
    archivedPremadeTagIds: Array.isArray(input.archivedPremadeTagIds)
      ? input.archivedPremadeTagIds
          .filter((item): item is string => typeof item === "string")
          .map((item) => item.trim())
          .filter(Boolean)
      : [],
  };
}

/**
 * Saves cookie-backed Academy settings.
 * Super-Admin-only keys (identityProvider) are locked unless the actor has
 * settings.manage_global — plain Admins cannot escalate via crafted payloads.
 */
export async function saveAcademySettings(
  input: AcademyAdminSettings,
): Promise<SaveAcademySettingsResult> {
  try {
    const profile = await getSessionProfile();
    if (!profile) return { ok: false, reason: "unauthorized" };
    const actor = { id: profile.user.id };

    const [canManage, canManageGlobal] = await Promise.all([
      canPerform(actor, "settings.manage"),
      canPerform(actor, "settings.manage_global"),
    ]);
    if (!canManage) return { ok: false, reason: "unauthorized" };

    const store = await cookies();
    const previous = parseAcademySettings(store.get(ACADEMY_SETTINGS_COOKIE)?.value);
    const requested = normalize(input);

    if (!canManageGlobal && superAdminSettingsChanged(previous, requested)) {
      return {
        ok: false,
        reason: "forbidden_global",
        message:
          "Identity verification and other platform settings can only be changed by an Academy Super Admin.",
      };
    }

    const settings = mergeAcademySettingsForSave({
      previous,
      next: requested,
      canManageGlobal,
    });

    store.set(ACADEMY_SETTINGS_COOKIE, JSON.stringify(settings), {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });

    await writeAcademyAdminAudit({
      actorUserId: actor.id,
      entityType: ACADEMY_AUDIT_ENTITY_SETTINGS,
      entityId: ACADEMY_SETTINGS_ENTITY_ID,
      action: "update",
      previousValue: { ...previous },
      newValue: {
        ...settings,
        result: "ok",
        globalKeysChanged: superAdminSettingsChanged(previous, settings),
      },
    });

    return { ok: true, settings };
  } catch {
    return { ok: false, reason: "failed" };
  }
}
