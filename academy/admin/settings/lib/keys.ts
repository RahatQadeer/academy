import type { AcademyAdminSettings } from "../types";

/**
 * Platform / security keys — Super Admin only (Ticket 9).
 * Operational catalog toggles stay Admin-manageable.
 */
export const SUPER_ADMIN_SETTINGS_KEYS = ["identityProvider"] as const;

export type SuperAdminSettingsKey = (typeof SUPER_ADMIN_SETTINGS_KEYS)[number];

export function isSuperAdminSettingsKey(key: string): key is SuperAdminSettingsKey {
  return (SUPER_ADMIN_SETTINGS_KEYS as readonly string[]).includes(key);
}

/** Merge a save payload: lock Super-Admin-only keys unless the actor may manage them. */
export function mergeAcademySettingsForSave(input: {
  previous: AcademyAdminSettings;
  next: AcademyAdminSettings;
  canManageGlobal: boolean;
}): AcademyAdminSettings {
  const { previous, next, canManageGlobal } = input;
  return {
    ...next,
    identityProvider: canManageGlobal ? next.identityProvider : previous.identityProvider,
  };
}

export function superAdminSettingsChanged(
  previous: AcademyAdminSettings,
  next: AcademyAdminSettings,
): boolean {
  return previous.identityProvider !== next.identityProvider;
}
