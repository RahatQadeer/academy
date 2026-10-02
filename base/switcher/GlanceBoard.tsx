"use client";

import { useState } from "react";
import { cn } from "@/base/lib/cn";
import type { SwitcherOverview } from "@/base/switcher/overview";
import { WhitbyPanel } from "@/base/switcher/OverviewPanel";

const TABS = [
  { id: "whitby", label: "Whitby", color: "var(--module-whitby-fg)" },
  { id: "portal", label: "Client Portal", color: "var(--module-portal-fg)" },
  { id: "academy", label: "Academy", color: "var(--module-academy-fg)" },
  { id: "partner", label: "Partner Center", color: "var(--module-partner-fg)" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export function GlanceBoard({ data }: { data: SwitcherOverview }) {
  const [tab, setTab] = useState<TabId>("whitby");

  return (
    <div>
      <div className="mb-4 flex gap-1 border-b border-line">
        {TABS.map((item) => {
          const on = tab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={cn("px-3 py-2 text-[13px] font-medium transition-colors")}
              aria-pressed={on}
              style={{
                color: on ? item.color : "var(--text-tertiary)",
                borderBottom: on ? `2px solid ${item.color}` : "2px solid transparent",
                marginBottom: -1,
              }}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      {tab === "whitby" ? <WhitbyPanel data={data.whitby} /> : null}
      {tab === "portal" ? <PortalGlance data={data.portal} /> : null}
      {tab === "academy" ? <AcademyGlance data={data.academy} /> : null}
      {tab === "partner" ? <PartnerGlance status={data.partner.status} referrals={data.partner.referrals} /> : null}
    </div>
  );
}

function PortalGlance({ data }: { data: SwitcherOverview["portal"] }) {
  const total = Math.max(data.workspaces, 1);
  const enabledPct = data.workspaces === 0 ? 0 : Math.min(100, (data.enabled / total) * 100);

  return (
    <section className="overflow-hidden rounded-card border border-line bg-surface">
      <div className="h-1" style={{ background: "var(--module-portal-fg)" }} />
      <div className="p-6">
        <div className="text-[13px] font-semibold">Client-visible access</div>
        <p className="mt-1 max-w-[520px] text-[13px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
          Counted from members with portal access on your workspaces. Clients sign in to
          the same identity — they never see Internal or Restricted work.
        </p>
        <div className="mt-5 grid gap-6 sm:grid-cols-3">
          <Stat value={String(data.enabled)} label="Portals enabled" />
          <Stat value={String(data.workspaces)} label="Workspaces" />
          <Stat value={String(data.signInsThisWeek)} label="Client sign-ins this week" />
        </div>
        <div className="mt-6">
          <div className="mb-2 flex justify-between text-[12px]" style={{ color: "var(--text-tertiary)" }}>
            <span>Enabled vs workspaces</span>
            <span>
              {data.enabled} of {data.workspaces}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-[3px]" style={{ background: "var(--border)" }}>
            <div
              className="h-full rounded-[3px] transition-[width] duration-300"
              style={{ width: `${enabledPct}%`, background: "var(--module-portal-fg)" }}
            />
          </div>
        </div>
      </div>
    </section>
  );
}

function AcademyGlance({ data }: { data: SwitcherOverview["academy"] }) {
  const total = Math.max(data.enrolled, 1);
  const pct = data.enrolled === 0 ? 0 : Math.min(100, (data.inProgress / total) * 100);

  return (
    <section className="overflow-hidden rounded-card border border-line bg-surface">
      <div className="h-1" style={{ background: "var(--module-academy-fg)" }} />
      <div className="p-6">
        <div className="text-[13px] font-semibold">Your learning</div>
        <p className="mt-1 max-w-[520px] text-[13px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
          Enrolments on this account. Programme names and progress come from Academy, not placeholders.
        </p>
        <div className="mt-5 grid gap-6 sm:grid-cols-2">
          <Stat value={String(data.inProgress)} label="Courses in progress" />
          <Stat value={String(data.enrolled)} label="Courses enrolled" />
        </div>
        {data.courses.length > 0 ? (
          <ul className="mt-5 flex flex-col gap-3">
            {data.courses.slice(0, 4).map((course, index) => (
              <li key={`${course.name}-${index}`}>
                <div className="mb-1 flex items-center justify-between gap-3">
                  <span className="truncate text-[13px] font-medium">{course.name}</span>
                  <span className="text-[12px]" style={{ color: "var(--text-tertiary)" }}>
                    {course.progress}%
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-[3px]" style={{ background: "var(--border)" }}>
                  <div
                    className="h-full rounded-[3px]"
                    style={{ width: `${course.progress}%`, background: "var(--module-academy-fg)" }}
                  />
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="mt-6">
            <div className="mb-2 flex justify-between text-[12px]" style={{ color: "var(--text-tertiary)" }}>
              <span>In progress of enrolled</span>
              <span>{Math.round(pct)}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-[3px]" style={{ background: "var(--border)" }}>
              <div
                className="h-full rounded-[3px] transition-[width] duration-300"
                style={{ width: `${pct}%`, background: "var(--module-academy-fg)" }}
              />
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function PartnerGlance({ status, referrals }: { status: string | null; referrals: number }) {
  const label = status
    ? partnerGlanceStatusLabel(status)
    : "Not enrolled";

  return (
    <section className="overflow-hidden rounded-card border border-line bg-surface">
      <div className="h-1" style={{ background: "var(--module-partner-fg)" }} />
      <div className="p-6">
        <div className="text-[13px] font-semibold">Introductions</div>
        <p className="mt-1 max-w-[520px] text-[13px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
          Partner Center is one referral link. Status and referral count are from your partner profile.
        </p>
        <div className="mt-5 grid gap-6 sm:grid-cols-2">
          <Stat value={label} label="Partner status" />
          <Stat value={String(referrals)} label="Referrals attributed" />
        </div>
      </div>
    </section>
  );
}

function partnerGlanceStatusLabel(status: string) {
  switch (status) {
    case "not_started":
      return "Not started";
    case "applied":
      return "Applied";
    case "under_review":
      return "Under review";
    case "approved":
      return "Approved";
    case "active":
      return "Active";
    case "declined":
      return "Declined";
    default:
      return status.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
  }
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <div className="text-[28px] font-bold leading-none tracking-[-0.5px]">{value}</div>
      <div className="mt-1.5 text-[12.5px]" style={{ color: "var(--text-secondary)" }}>
        {label}
      </div>
    </div>
  );
}
