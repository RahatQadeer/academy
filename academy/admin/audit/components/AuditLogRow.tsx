import type { ReactNode } from "react";
import type { AcademyAuditLogItem } from "../types";

function formatWhen(iso: string) {
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function actionLabel(item: AcademyAuditLogItem) {
  const role =
    typeof item.newValue?.role === "string"
      ? item.newValue.role
      : typeof item.previousValue?.role === "string"
        ? item.previousValue.role
        : null;

  if (item.entityType === "academy_settings") return "Updated settings";
  if (item.action === "suspend" && item.entityType === "user") return "Suspended account";
  if (item.action === "soft_delete") return "Deleted account";
  if (item.action === "restore") return "Restored account";
  if (item.action === "restore_deleted") return "Restored deleted account";
  if (item.action === "grant_admin") return "Granted Admin";
  if (item.action === "revoke_admin") return "Suspended Admin";
  if (item.action === "reactivate_admin") return "Restored Admin";
  if (item.action === "revoke_instructor") return "Revoked Instructor";
  if (item.action === "grant_super_admin") return "Granted Super Admin";
  if (item.action === "revoke_super_admin") return "Suspended Super Admin";
  if (item.action === "reactivate_super_admin") return "Restored Super Admin";
  if (role) return `${item.action.replaceAll("_", " ")} (${role})`;
  return item.action.replaceAll("_", " ");
}

type Tone = "neutral" | "warning" | "danger" | "success" | "accent";

function actionTone(item: AcademyAuditLogItem): Tone {
  if (item.entityType === "academy_settings") return "accent";
  if (item.action === "soft_delete") return "danger";
  if (item.action === "suspend" || item.action === "revoke_admin" || item.action === "revoke_super_admin") {
    return "warning";
  }
  if (
    item.action === "restore" ||
    item.action === "restore_deleted" ||
    item.action === "reactivate_admin" ||
    item.action === "reactivate_super_admin" ||
    item.action === "grant_admin" ||
    item.action === "grant_super_admin"
  ) {
    return "success";
  }
  return "neutral";
}

function BanIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="8.25" stroke="currentColor" strokeWidth="1.75" />
      <path d="M7.2 7.2l9.6 9.6" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M4 7h16" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      <path
        d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
      <path
        d="M7.5 7l.7 11.4A1.5 1.5 0 0 0 9.7 20h4.6a1.5 1.5 0 0 0 1.5-1.6L16.5 7"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function RestoreIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M3.5 12a8.5 8.5 0 1 0 2.4-5.9"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
      <path
        d="M3.5 4.5v5h5"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 3.5 5.5 6.2v5.1c0 4.2 2.8 7.8 6.5 9.2 3.7-1.4 6.5-5 6.5-9.2V6.2L12 3.5Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.75" />
      <path
        d="M12 3.5v2.2M12 18.3v2.2M4.9 6.5l1.6 1.5M17.5 16l1.6 1.5M3.5 12h2.2M18.3 12h2.2M4.9 17.5l1.6-1.5M17.5 8l1.6-1.5"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  );
}

function DotIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="3.5" stroke="currentColor" strokeWidth="1.75" />
    </svg>
  );
}

function actionIcon(item: AcademyAuditLogItem): ReactNode {
  if (item.entityType === "academy_settings") return <SettingsIcon />;
  if (item.action === "soft_delete") return <TrashIcon />;
  if (item.action === "suspend" || item.action === "revoke_admin" || item.action === "revoke_super_admin") {
    return <BanIcon />;
  }
  if (
    item.action === "restore" ||
    item.action === "restore_deleted" ||
    item.action === "reactivate_admin" ||
    item.action === "reactivate_super_admin"
  ) {
    return <RestoreIcon />;
  }
  if (item.action.includes("admin") || item.action.includes("grant")) return <ShieldIcon />;
  return <DotIcon />;
}

const TONE_STYLE: Record<Tone, { fg: string; bg: string }> = {
  neutral: { fg: "var(--text-secondary)", bg: "var(--surface-soft)" },
  warning: { fg: "var(--warning-fg, #7a5a2e)", bg: "var(--warning-bg, #fdf7ee)" },
  danger: { fg: "var(--danger-fg, #5d1715)", bg: "var(--danger-bg, #ffe2dd)" },
  success: { fg: "var(--success-fg, #1c7a52)", bg: "var(--success-bg, #d6ecd8)" },
  accent: { fg: "var(--accent)", bg: "var(--accent-tint)" },
};

function statusPill(item: AcademyAuditLogItem): { label: string; tone: Tone } | null {
  const status = typeof item.newValue?.status === "string" ? item.newValue.status : null;
  if (status === "active") return { label: "Active", tone: "success" };
  if (status === "suspended") return { label: "Suspended", tone: "warning" };
  if (status === "deleted") return { label: "Deleted", tone: "danger" };
  const outcome = typeof item.newValue?.outcome === "string" ? item.newValue.outcome : null;
  if (outcome) {
    return { label: outcome.replaceAll("_", " "), tone: "neutral" };
  }
  return null;
}

export function AuditLogRow({ item }: { item: AcademyAuditLogItem }) {
  const tone = actionTone(item);
  const colors = TONE_STYLE[tone];
  const pill = statusPill(item);

  return (
    <article className="flex gap-3.5 px-4 py-3.5 sm:px-5 sm:py-4">
      <div
        className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
        style={{ background: colors.bg, color: colors.fg }}
        aria-hidden
      >
        {actionIcon(item)}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <h3
            className="text-[14.5px] font-semibold tracking-[-0.2px]"
            style={{ color: "var(--ink)" }}
          >
            {actionLabel(item)}
          </h3>
          <time
            className="shrink-0 text-[12px] tabular-nums"
            style={{ color: "var(--text-tertiary)" }}
            dateTime={item.createdAt}
          >
            {formatWhen(item.createdAt)}
          </time>
        </div>

        <p className="mt-0.5 text-[13px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
          <span style={{ color: "var(--ink)" }}>{item.actorDisplayName}</span>
          {item.targetDisplayName ? (
            <>
              <span style={{ color: "var(--text-tertiary)" }}> → </span>
              <span style={{ color: "var(--ink)" }}>{item.targetDisplayName}</span>
            </>
          ) : null}
        </p>

        {pill || item.reason?.trim() ? (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {pill ? (
              <span
                className="rounded-full px-2 py-0.5 text-[11px] font-medium capitalize"
                style={{
                  background: TONE_STYLE[pill.tone].bg,
                  color: TONE_STYLE[pill.tone].fg,
                }}
              >
                {pill.label}
              </span>
            ) : null}
            {item.reason?.trim() ? (
              <span className="text-[12px]" style={{ color: "var(--text-tertiary)" }}>
                {item.reason.trim()}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
    </article>
  );
}
