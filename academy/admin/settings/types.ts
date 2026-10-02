export const IDENTITY_PROVIDERS = ["persona", "none"] as const;

export type IdentityProvider = (typeof IDENTITY_PROVIDERS)[number];

export type AcademyAdminSettings = {
  instructorPublishApproval: boolean;
  whitbyAssistedDrafting: boolean;
  /** Identity verification provider for credentials — Super Admin only (Ticket 9). */
  identityProvider: IdentityProvider;
  credentialExpirationNotices: boolean;
  /** Custom course topic tags (bank). Stored with other Academy admin settings. */
  customCourseTags: string[];
  /** Premade tag slugs hidden from the bank by an admin. */
  archivedPremadeTagIds: string[];
};

export type AcademySettingsResult =
  | {
      ok: true;
      settings: AcademyAdminSettings;
      /** Whether the viewer may change Super-Admin-only keys. */
      canManageGlobal: boolean;
    }
  | { ok: false; reason: "unauthorized" | "failed" };

export type SaveAcademySettingsResult =
  | { ok: true; settings: AcademyAdminSettings }
  | {
      ok: false;
      reason: "unauthorized" | "forbidden_global" | "failed";
      message?: string;
    };
