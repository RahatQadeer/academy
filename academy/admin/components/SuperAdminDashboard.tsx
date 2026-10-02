import Link from "next/link";
import type { ReactNode } from "react";
import type { AdminDashboardData } from "../types";
import { WavyMeter } from "./WavyMeter";

const CARD_SHADOW = "0 1px 2px rgba(15,15,15,.04), 0 8px 24px rgba(15,15,15,.03)";

function Chevron() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden className="shrink-0">
      <path
        d="M5 3.5L8.5 7L5 10.5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function UsersIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
      <circle cx="7" cy="6" r="2.4" stroke="currentColor" strokeWidth="1.4" />
      <path
        d="M2.8 14c.4-2.3 2-3.5 4.2-3.5s3.8 1.2 4.2 3.5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <circle cx="12.4" cy="6.6" r="1.8" stroke="currentColor" strokeWidth="1.4" />
      <path d="M11.6 14c.25-1.4 1-2.3 2-2.7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function InstructorsIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
      <path
        d="M9 2.2 16.2 5.8 9 9.4 1.8 5.8 9 2.2Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path
        d="M4.2 7.6v3.5c0 1.1 2.1 2.2 4.8 2.2s4.8-1.1 4.8-2.2V7.6"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

function AdminIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
      <path
        d="M9 2.4l5.8 1.9v5c0 3.2-2.2 5.5-5.8 6.3-3.6-.8-5.8-3.1-5.8-6.3v-5L9 2.4z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function LearnersIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
      <circle cx="9" cy="6.2" r="2.5" stroke="currentColor" strokeWidth="1.4" />
      <path
        d="M3.5 14.2c.6-2.6 2.6-3.9 5.5-3.9s4.9 1.3 5.5 3.9"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

function AuditIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
      <rect x="3.2" y="2.8" width="11.6" height="12.4" rx="2" stroke="currentColor" strokeWidth="1.4" />
      <path d="M6 6.5h6M6 9h6M6 11.5h3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

type Tone = "purple" | "accent" | "success" | "warning" | "info" | "tan";

const TONE: Record<Tone, { bg: string; fg: string; bar: string }> = {
  purple: { bg: "var(--module-academy-bg, #e9e4f3)", fg: "var(--module-academy-fg, #6b4fa8)", bar: "#6b4fa8" },
  accent: { bg: "var(--accent-tint)", fg: "var(--accent)", bar: "var(--accent)" },
  success: { bg: "var(--success-bg)", fg: "var(--success-fg)", bar: "var(--success-fg)" },
  warning: { bg: "var(--warning-bg)", fg: "var(--warning-fg)", bar: "var(--warning-fg)" },
  info: { bg: "var(--info-bg)", fg: "var(--info-fg)", bar: "var(--info-fg)" },
  tan: { bg: "#f1e9db", fg: "#8a6f3e", bar: "#8a6f3e" },
};

type RoleSlice = {
  label: string;
  value: number;
  href: string;
  tone: Tone;
  icon: ReactNode;
};

type Shortcut = {
  href: string;
  label: string;
  detail: string;
  tone: Tone;
  icon: ReactNode;
};

export function SuperAdminDashboard({
  data,
  greeting,
}: {
  data: AdminDashboardData;
  greeting: string;
}) {
  const totalPeople =
    data.learnerCount + data.instructorCount + data.adminCount + data.superAdminCount;
  const activeStaff = data.adminCount + data.instructorCount;

  const roles: RoleSlice[] = [
    {
      label: "Learners",
      value: data.learnerCount,
      href: "/academy/admin/enrollments",
      tone: "success",
      icon: <LearnersIcon />,
    },
    {
      label: "Instructors",
      value: data.instructorCount,
      href: "/academy/admin/instructors",
      tone: "accent",
      icon: <InstructorsIcon />,
    },
    {
      label: "Admins",
      value: data.adminCount,
      href: "/academy/admin/admins",
      tone: "purple",
      icon: <AdminIcon />,
    },
  ];

  const shortcuts: Shortcut[] = [
    {
      href: "/academy/admin/users",
      label: "Users",
      detail: "Directory — suspend or soft-delete",
      tone: "info",
      icon: <UsersIcon />,
    },
    {
      href: "/academy/admin/instructors",
      label: "Instructors",
      detail: `${data.instructorCount.toLocaleString()} active · grant or revoke`,
      tone: "accent",
      icon: <InstructorsIcon />,
    },
    {
      href: "/academy/admin/admins",
      label: "Admins",
      detail: `${data.adminCount.toLocaleString()} active · invite or revoke`,
      tone: "purple",
      icon: <AdminIcon />,
    },
    {
      href: "/academy/admin/enrollments",
      label: "Learners",
      detail: `${data.learnerCount.toLocaleString()} active memberships`,
      tone: "success",
      icon: <LearnersIcon />,
    },
    {
      href: "/academy/admin/audit",
      label: "Activity log",
      detail: "Role and account changes",
      tone: "tan",
      icon: <AuditIcon />,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Hero */}
      <section
        className="relative overflow-hidden rounded-[16px] px-5 py-6 sm:px-7 sm:py-7"
        style={{
          background:
            "linear-gradient(135deg, color-mix(in srgb, var(--module-academy-bg, #e9e4f3) 70%, white) 0%, var(--surface) 48%, color-mix(in srgb, var(--accent-tint) 55%, white) 100%)",
          border: "1px solid var(--border)",
          boxShadow: CARD_SHADOW,
        }}
      >
        <div
          className="pointer-events-none absolute -right-10 -top-12 h-40 w-40 rounded-full opacity-40"
          style={{ background: "radial-gradient(circle, var(--module-academy-bg, #e9e4f3) 0%, transparent 70%)" }}
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -bottom-16 right-20 h-36 w-36 rounded-full opacity-35"
          style={{ background: "radial-gradient(circle, var(--accent-tint) 0%, transparent 70%)" }}
          aria-hidden
        />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0 max-w-xl">
            <p
              className="text-[11px] font-semibold uppercase tracking-[0.08em]"
              style={{ color: "var(--module-academy-fg, #6b4fa8)" }}
            >
              Super Admin
            </p>
            <h1 className="mt-1.5 text-[28px] font-bold tracking-[-0.5px] sm:text-[32px]" style={{ color: "var(--ink)" }}>
              {greeting}
            </h1>
            <p className="mt-2 text-[14.5px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
              Manage people and access across Academy. Instructors and Admins create programs —
              you keep roles and accounts in order.
            </p>
          </div>
          <div className="flex flex-wrap gap-2.5">
            <Link
              href="/academy/admin/users"
              className="inline-flex items-center gap-1.5 rounded-[10px] px-3.5 py-2 text-[13px] font-semibold no-underline transition-opacity hover:opacity-90"
              style={{ background: "var(--ink)", color: "#fff" }}
            >
              Open directory
              <Chevron />
            </Link>
            <Link
              href="/academy/admin/admins"
              className="inline-flex items-center gap-1.5 rounded-[10px] border bg-surface px-3.5 py-2 text-[13px] font-semibold text-ink no-underline transition-colors hover:bg-[var(--surface-soft)]"
              style={{ borderColor: "var(--border)" }}
            >
              Manage Admins
            </Link>
          </div>
        </div>
      </section>

      {/* Snapshot */}
      <section aria-label="People snapshot" className="grid gap-3 sm:grid-cols-3">
        <article
          className="rounded-[14px] bg-surface px-5 py-4"
          style={{ border: "1px solid var(--border)", boxShadow: CARD_SHADOW }}
        >
          <p className="text-[11.5px] font-semibold uppercase tracking-[0.06em]" style={{ color: "var(--text-tertiary)" }}>
            Total people
          </p>
          <p className="mt-2 text-[34px] font-bold tabular-nums tracking-[-0.8px]" style={{ color: "var(--ink)" }}>
            {totalPeople.toLocaleString()}
          </p>
          <p className="mt-1 text-[12.5px]" style={{ color: "var(--text-tertiary)" }}>
            Across every Academy role
          </p>
        </article>
        <article
          className="rounded-[14px] bg-surface px-5 py-4"
          style={{ border: "1px solid var(--border)", boxShadow: CARD_SHADOW }}
        >
          <p className="text-[11.5px] font-semibold uppercase tracking-[0.06em]" style={{ color: "var(--text-tertiary)" }}>
            Staff
          </p>
          <p className="mt-2 text-[34px] font-bold tabular-nums tracking-[-0.8px]" style={{ color: "var(--ink)" }}>
            {activeStaff.toLocaleString()}
          </p>
          <p className="mt-1 text-[12.5px]" style={{ color: "var(--text-tertiary)" }}>
            {data.adminCount.toLocaleString()} admins · {data.instructorCount.toLocaleString()} instructors
          </p>
        </article>
        <article
          className="rounded-[14px] bg-surface px-5 py-4"
          style={{ border: "1px solid var(--border)", boxShadow: CARD_SHADOW }}
        >
          <p className="text-[11.5px] font-semibold uppercase tracking-[0.06em]" style={{ color: "var(--text-tertiary)" }}>
            Suspended
          </p>
          <p className="mt-2 text-[34px] font-bold tabular-nums tracking-[-0.8px]" style={{ color: "var(--warning-fg)" }}>
            {data.suspendedMembershipTotal.toLocaleString()}
          </p>
          <p className="mt-1 text-[12.5px]" style={{ color: "var(--text-tertiary)" }}>
            <Link href="/academy/admin/users" className="font-medium text-accent no-underline hover:text-accent-hover">
              Review in Users →
            </Link>
          </p>
        </article>
      </section>

      {/* Role mix */}
      <section
        aria-labelledby="sa-role-mix"
        className="overflow-hidden rounded-[14px] bg-surface"
        style={{ border: "1px solid var(--border)", boxShadow: CARD_SHADOW }}
      >
        <div className="border-b px-5 py-4 sm:px-6" style={{ borderColor: "var(--border)" }}>
          <h2 id="sa-role-mix" className="text-[15px] font-semibold tracking-[-0.2px]">
            Role mix
          </h2>
          <p className="mt-0.5 text-[13px]" style={{ color: "var(--text-tertiary)" }}>
            Active memberships by role — tap a row to manage that group
          </p>
        </div>
        <ul className="m-0 list-none divide-y p-0" style={{ borderColor: "var(--border)" }}>
          {roles.map((role, index) => {
            const tone = TONE[role.tone];
            const pct = totalPeople > 0 ? Math.round((role.value / totalPeople) * 100) : 0;
            return (
              <li key={role.label}>
                <Link
                  href={role.href}
                  className="flex items-center gap-3.5 px-5 py-3.5 no-underline transition-colors hover:bg-[var(--surface-soft)] sm:px-6"
                >
                  <span
                    className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px]"
                    style={{ background: tone.bg, color: tone.fg }}
                  >
                    {role.icon}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="text-[14px] font-medium text-ink">{role.label}</p>
                      <p className="text-[14px] font-semibold tabular-nums text-ink">
                        {role.value.toLocaleString()}
                        <span className="ml-1.5 text-[12px] font-medium" style={{ color: "var(--text-tertiary)" }}>
                          {pct}%
                        </span>
                      </p>
                    </div>
                    <WavyMeter
                      pct={pct}
                      color={tone.bar}
                      id={role.label.toLowerCase()}
                      delayMs={index * 90}
                    />
                  </div>
                  <span style={{ color: "var(--text-tertiary)" }}>
                    <Chevron />
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      {/* Shortcuts */}
      <section aria-labelledby="sa-shortcuts">
        <div className="mb-3 flex items-end justify-between gap-3 px-0.5">
          <div>
            <h2 id="sa-shortcuts" className="text-[15px] font-semibold tracking-[-0.2px]">
              Quick actions
            </h2>
            <p className="mt-0.5 text-[13px]" style={{ color: "var(--text-tertiary)" }}>
              Jump into people management
            </p>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {shortcuts.map((item) => {
            const tone = TONE[item.tone];
            return (
              <Link
                key={item.href}
                href={item.href}
                className="group flex items-start gap-3.5 rounded-[14px] bg-surface px-4 py-4 text-ink no-underline transition-[border-color,background,transform] hover:-translate-y-px hover:bg-[var(--surface-soft)]"
                style={{ border: "1px solid var(--border)", boxShadow: CARD_SHADOW }}
              >
                <span
                  className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px]"
                  style={{ background: tone.bg, color: tone.fg }}
                >
                  {item.icon}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <span className="text-[14.5px] font-semibold tracking-[-0.15px]">{item.label}</span>
                    <span
                      className="opacity-40 transition-opacity group-hover:opacity-100"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      <Chevron />
                    </span>
                  </span>
                  <span className="mt-0.5 block text-[12.5px] leading-snug" style={{ color: "var(--text-tertiary)" }}>
                    {item.detail}
                  </span>
                </span>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
