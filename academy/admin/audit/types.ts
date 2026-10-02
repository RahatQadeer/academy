export const AUDIT_LOG_PAGE_SIZE = 50;

export type AcademyAuditEntityType =
  | "user"
  | "academy_membership"
  | "academy_settings"
  | string;

export type AcademyAuditLogItem = {
  id: string;
  actorUserId: string;
  actorDisplayName: string;
  actorEmail: string | null;
  entityType: AcademyAuditEntityType;
  entityId: string;
  targetDisplayName: string | null;
  targetEmail: string | null;
  action: string;
  previousValue: Record<string, unknown> | null;
  newValue: Record<string, unknown> | null;
  reason: string | null;
  createdAt: string;
};

export type LoadAuditLogsResult =
  | {
      ok: true;
      data: {
        items: AcademyAuditLogItem[];
        truncated: boolean;
      };
    }
  | { ok: false; reason: "unauthorized" | "unavailable" | "failed"; message?: string };
