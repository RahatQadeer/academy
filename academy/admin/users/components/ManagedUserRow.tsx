"use client";

import { useState, useTransition, type ReactNode } from "react";
import { ConfirmDialog } from "@/academy/admin/catalog/components/ConfirmDialog";
import { ACADEMY_ROLE_THEME } from "@/academy/lib/roleTheme";
import { setUserAccountStatusAction } from "../actions";
import type { ManagedAcademyRole, ManagedUser, SetUserStatusAction } from "../types";

function statusLabel(status: ManagedUser["status"]) {
  if (status === "suspended") return "Suspended";
  if (status === "deleted") return "Deleted";
  return "Active";
}

function roleLabel(role: ManagedAcademyRole) {
  if (role === "super_admin") return "Super Admin";
  if (role === "admin") return "Admin";
  if (role === "instructor") return "Instructor";
  return "Learner";
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}

/** Outline ban — suspend account */
function SuspendIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="8.25" stroke="currentColor" strokeWidth="1.75" />
      <path
        d="M7.2 7.2l9.6 9.6"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Outline trash — delete */
function DeleteIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
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

/** Outline rotate — restore */
function RestoreIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
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

type ActionTone = "warning" | "danger" | "restore";

function IconAction({
  label,
  tone,
  icon,
  disabled,
  onClick,
}: {
  label: string;
  tone: ActionTone;
  icon: ReactNode;
  disabled?: boolean;
  onClick: () => void;
}) {
  const color =
    tone === "warning"
      ? "var(--warning-fg, #7a5a2e)"
      : tone === "danger"
        ? "var(--danger-fg, #5d1715)"
        : "var(--success-fg, #1c7a52)";

  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[9px] bg-transparent transition-[background,opacity,color] duration-150 enabled:hover:bg-[var(--surface-soft)] disabled:cursor-not-allowed disabled:opacity-50"
      style={{ color }}
    >
      {icon}
    </button>
  );
}

export function ManagedUserRow({
  user,
  onChanged,
}: {
  user: ManagedUser;
  onChanged: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<SetUserStatusAction | null>(null);

  function run(action: SetUserStatusAction) {
    startTransition(async () => {
      setError(null);
      const result = await setUserAccountStatusAction(user.userId, action);
      if (!result.ok) {
        setError(result.message || "The account could not be updated.");
        setConfirm(null);
        return;
      }
      setConfirm(null);
      onChanged();
    });
  }

  const protectedAccount = user.isAcademySuperAdmin;
  const theme = ACADEMY_ROLE_THEME[user.academyRole];
  const statusMuted = user.status !== "active";

  return (
    <article
      className="group flex flex-col gap-3 rounded-[14px] bg-white p-4 transition-[box-shadow,transform] duration-200 sm:flex-row sm:items-center sm:justify-between sm:px-5 sm:py-4"
      style={{
        border: "1px solid var(--border)",
        boxShadow: "0 1px 2px rgba(55,53,47,0.03)",
      }}
    >
      <div className="flex min-w-0 items-start gap-3.5">
        <div
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[13px] font-semibold tracking-[-0.2px]"
          style={{
            background: theme.tint,
            color: theme.accent,
          }}
          aria-hidden
        >
          {initials(user.displayName)}
        </div>
        <div className="min-w-0 pt-0.5">
          <div className="flex flex-wrap items-center gap-2">
            <h3
              className="truncate text-[15px] font-semibold tracking-[-0.2px]"
              style={{ color: "var(--ink)" }}
            >
              {user.displayName}
            </h3>
            <span
              className="rounded-full px-2 py-0.5 text-[11px] font-semibold"
              style={{
                background: theme.tint,
                color: theme.accent,
              }}
            >
              {roleLabel(user.academyRole)}
            </span>
            {statusMuted ? (
              <span
                className="rounded-full px-2 py-0.5 text-[11px] font-medium"
                style={{
                  background:
                    user.status === "deleted" ? "var(--danger-bg, #ffe2dd)" : "var(--warning-bg)",
                  color:
                    user.status === "deleted"
                      ? "var(--danger-fg, #5d1715)"
                      : "var(--warning-fg, #7a5a2e)",
                }}
              >
                {statusLabel(user.status)}
              </span>
            ) : null}
          </div>
          {user.email ? (
            <p className="mt-0.5 truncate text-[13px]" style={{ color: "var(--text-tertiary)" }}>
              {user.email}
            </p>
          ) : null}
          {error ? (
            <p className="mt-2 text-[12.5px]" style={{ color: "var(--danger-fg)" }}>
              {error}
            </p>
          ) : null}
        </div>
      </div>

      <div className="flex gap-1.5 sm:justify-end">
        {protectedAccount ? (
          <p
            className="max-w-[16rem] text-[12.5px] leading-relaxed"
            style={{ color: "var(--text-tertiary)" }}
          >
            Protected
          </p>
        ) : user.status === "active" ? (
          <>
            <IconAction
              label="Suspend"
              tone="warning"
              icon={<SuspendIcon />}
              disabled={pending}
              onClick={() => setConfirm("suspend")}
            />
            <IconAction
              label="Delete"
              tone="danger"
              icon={<DeleteIcon />}
              disabled={pending}
              onClick={() => setConfirm("soft_delete")}
            />
          </>
        ) : user.status === "suspended" ? (
          <>
            <IconAction
              label="Restore"
              tone="restore"
              icon={<RestoreIcon />}
              disabled={pending}
              onClick={() => run("restore")}
            />
            <IconAction
              label="Delete"
              tone="danger"
              icon={<DeleteIcon />}
              disabled={pending}
              onClick={() => setConfirm("soft_delete")}
            />
          </>
        ) : (
          <IconAction
            label="Restore"
            tone="restore"
            icon={<RestoreIcon />}
            disabled={pending}
            onClick={() => setConfirm("restore_deleted")}
          />
        )}
      </div>

      {confirm === "suspend" ? (
        <ConfirmDialog
          title="Suspend this account?"
          body={`${user.displayName} will not be able to sign in until restored.`}
          confirmLabel="Suspend"
          pendingLabel="Suspending…"
          pending={pending}
          destructive
          onConfirm={() => run("suspend")}
          onClose={() => {
            if (!pending) setConfirm(null);
          }}
        />
      ) : null}

      {confirm === "soft_delete" ? (
        <ConfirmDialog
          title="Delete this account?"
          body={`${user.displayName} will be soft-deleted. You can restore later.`}
          confirmLabel="Delete"
          pendingLabel="Deleting…"
          pending={pending}
          destructive
          onConfirm={() => run("soft_delete")}
          onClose={() => {
            if (!pending) setConfirm(null);
          }}
        />
      ) : null}

      {confirm === "restore_deleted" ? (
        <ConfirmDialog
          title="Restore account?"
          body={`${user.displayName} will become active again.`}
          confirmLabel="Restore"
          pendingLabel="Restoring…"
          pending={pending}
          destructive={false}
          onConfirm={() => run("restore_deleted")}
          onClose={() => {
            if (!pending) setConfirm(null);
          }}
        />
      ) : null}
    </article>
  );
}
