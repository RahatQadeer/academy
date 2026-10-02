import { IDENTITY_PROVIDERS, type AcademyAdminSettings, type IdentityProvider } from "../types";

export const ACADEMY_SETTINGS_COOKIE = "academy_admin_settings";

export const DEFAULT_ACADEMY_SETTINGS: AcademyAdminSettings = {
  instructorPublishApproval: true,
  whitbyAssistedDrafting: true,
  identityProvider: "persona",
  credentialExpirationNotices: true,
  customCourseTags: [],
  archivedPremadeTagIds: [],
};

export function isIdentityProvider(value: unknown): value is IdentityProvider {
  return typeof value === "string" && IDENTITY_PROVIDERS.includes(value as IdentityProvider);
}

function parseStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function parseAcademySettings(raw: string | undefined | null): AcademyAdminSettings {
  if (!raw) return { ...DEFAULT_ACADEMY_SETTINGS, customCourseTags: [], archivedPremadeTagIds: [] };
  try {
    const parsed = JSON.parse(raw) as Partial<AcademyAdminSettings>;
    return {
      instructorPublishApproval:
        typeof parsed.instructorPublishApproval === "boolean"
          ? parsed.instructorPublishApproval
          : DEFAULT_ACADEMY_SETTINGS.instructorPublishApproval,
      whitbyAssistedDrafting:
        typeof parsed.whitbyAssistedDrafting === "boolean"
          ? parsed.whitbyAssistedDrafting
          : DEFAULT_ACADEMY_SETTINGS.whitbyAssistedDrafting,
      identityProvider: isIdentityProvider(parsed.identityProvider)
        ? parsed.identityProvider
        : DEFAULT_ACADEMY_SETTINGS.identityProvider,
      credentialExpirationNotices:
        typeof parsed.credentialExpirationNotices === "boolean"
          ? parsed.credentialExpirationNotices
          : DEFAULT_ACADEMY_SETTINGS.credentialExpirationNotices,
      customCourseTags: parseStringList(parsed.customCourseTags),
      archivedPremadeTagIds: parseStringList(parsed.archivedPremadeTagIds),
    };
  } catch {
    return { ...DEFAULT_ACADEMY_SETTINGS, customCourseTags: [], archivedPremadeTagIds: [] };
  }
}
