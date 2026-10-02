"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { Pill } from "@/base/components/Pill";
import { PaginationBar } from "@/academy/components/ui";
import { programTypeLabel } from "@/academy/lib/domain";
import {
  STAFF_PAGE_SIZE,
  type StaffAssignmentRef,
  type StaffCreatedProgram,
  type StaffPersonRef,
  type StaffPublishRequest,
} from "@/academy/admin/lib/staffActivityTypes";

const CARD_SHADOW = "0 1px 2px rgba(15,15,15,.04), 0 8px 24px rgba(15,15,15,.035)";

export type StaffMetricKey = string;

export type StaffMetricDef = {
  key: StaffMetricKey;
  label: string;
  value: number;
  detail: string;
};

function formatWhen(iso: string | null) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function statusTone(status: string) {
  if (status === "published" || status === "approved") return "success" as const;
  if (status === "pending_approval" || status === "pending") return "warning" as const;
  if (status === "rejected") return "danger" as const;
  return "neutral" as const;
}

function statusLabel(status: string) {
  if (status === "published") return "Published";
  if (status === "pending_approval") return "Pending approval";
  if (status === "pending") return "Pending";
  if (status === "approved") return "Approved";
  if (status === "rejected") return "Returned";
  return "Draft";
}

function MetricCard({
  metric,
  active,
  onSelect,
  compact,
}: {
  metric: StaffMetricDef;
  active: boolean;
  onSelect: () => void;
  compact?: boolean;
}) {
  if (compact) {
    return (
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={active}
        className="min-w-0 px-4 py-3.5 text-left transition-colors"
        style={{
          border: "none",
          background: active
            ? "color-mix(in srgb, var(--accent) 9%, var(--surface))"
            : "var(--surface)",
          boxShadow: active ? "inset 0 -2px 0 0 var(--accent)" : "none",
          cursor: "pointer",
        }}
      >
        <p
          className="text-[11px] font-semibold uppercase tracking-[0.06em]"
          style={{ color: active ? "var(--accent)" : "var(--text-tertiary)" }}
        >
          {metric.label}
        </p>
        <p
          className="mt-1.5 text-[22px] font-semibold tabular-nums tracking-[-0.4px] leading-none"
          style={{ color: "var(--ink)" }}
        >
          {metric.value.toLocaleString()}
        </p>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onSelect}
      className="rounded-[12px] bg-surface px-4 py-4 text-left transition-all"
      style={{
        border: active ? "1px solid var(--accent)" : "1px solid var(--border)",
        boxShadow: active
          ? "0 0 0 3px color-mix(in srgb, var(--accent) 16%, transparent), " + CARD_SHADOW
          : CARD_SHADOW,
        cursor: "pointer",
      }}
    >
      <p className="text-[24px] font-semibold tabular-nums tracking-[-0.4px]">
        {metric.value.toLocaleString()}
      </p>
      <p className="mt-1.5 text-[13.5px] font-medium">{metric.label}</p>
      <p className="mt-0.5 text-[12px]" style={{ color: "var(--text-tertiary)" }}>
        {metric.detail}
      </p>
      <p className="mt-2.5 text-[12px] font-medium text-accent">
        {active ? "Showing below" : "View list →"}
      </p>
    </button>
  );
}

function listRowClass(compact?: boolean) {
  return compact
    ? "flex flex-col gap-1.5 px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:px-5"
    : "flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6";
}

export function StaffActivityExplore({
  title,
  metrics,
  defaultKey,
  panels,
  compact = false,
}: {
  title: string;
  metrics: StaffMetricDef[];
  defaultKey: StaffMetricKey;
  panels: Record<
    StaffMetricKey,
    {
      heading: string;
      description: string;
      empty: string;
      items: ReactNode[];
    }
  >;
  /** Catalog-style KPI strip + list — used on Admin and Instructor profiles. */
  compact?: boolean;
}) {
  const [activeKey, setActiveKey] = useState<StaffMetricKey>(defaultKey);
  const [page, setPage] = useState(1);
  const panel = panels[activeKey] ?? panels[defaultKey];
  const total = panel.items.length;
  const pageCount = Math.max(1, Math.ceil(total / STAFF_PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const rangeStart = total === 0 ? 0 : (safePage - 1) * STAFF_PAGE_SIZE + 1;
  const rangeEnd = Math.min(safePage * STAFF_PAGE_SIZE, total);
  const pageItems = useMemo(() => {
    const start = (safePage - 1) * STAFF_PAGE_SIZE;
    return panel.items.slice(start, start + STAFF_PAGE_SIZE);
  }, [panel.items, safePage]);

  function selectMetric(key: StaffMetricKey) {
    setActiveKey(key);
    setPage(1);
  }

  if (compact) {
    const cols =
      metrics.length <= 3
        ? "sm:grid-cols-3"
        : metrics.length === 4
          ? "sm:grid-cols-4"
          : metrics.length === 5
            ? "sm:grid-cols-5"
            : "sm:grid-cols-3 lg:grid-cols-6";

    return (
      <section className="space-y-3" aria-labelledby="staff-activity-heading">
        <div className="flex items-baseline justify-between gap-3">
          <h2 id="staff-activity-heading" className="text-[15px] font-semibold tracking-[-0.2px]">
            {title}
          </h2>
          <p className="text-[12px]" style={{ color: "var(--text-tertiary)" }}>
            {panel.heading}
            {total > 0 ? ` · ${total.toLocaleString()}` : ""}
          </p>
        </div>

        <div
          className={`grid grid-cols-2 gap-px overflow-hidden rounded-[10px] ${cols}`}
          style={{ border: "1px solid var(--border)", background: "var(--border)" }}
          role="tablist"
          aria-label="Activity metrics"
        >
          {metrics.map((metric) => (
            <MetricCard
              key={metric.key}
              metric={metric}
              active={activeKey === metric.key}
              compact
              onSelect={() => selectMetric(metric.key)}
            />
          ))}
        </div>

        <div
          className="overflow-hidden rounded-[10px] bg-surface"
          style={{ border: "1px solid var(--border)" }}
        >
          {total === 0 ? (
            <p className="px-4 py-8 text-center text-[13px] sm:px-5" style={{ color: "var(--text-tertiary)" }}>
              {panel.empty}
            </p>
          ) : (
            <>
              <ul className="m-0 list-none divide-y p-0" style={{ borderColor: "var(--border)" }}>
                {pageItems}
              </ul>
              {pageCount > 1 ? (
                <div className="border-t px-4 py-2.5 sm:px-5" style={{ borderColor: "var(--border)" }}>
                  <PaginationBar
                    page={safePage}
                    pageCount={pageCount}
                    total={total}
                    rangeStart={rangeStart}
                    rangeEnd={rangeEnd}
                    itemLabel="items"
                    onPageChange={setPage}
                    compact
                  />
                </div>
              ) : null}
            </>
          )}
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-4" aria-labelledby="staff-activity-heading">
      <div>
        <h2 id="staff-activity-heading" className="text-[15px] font-semibold tracking-[-0.2px]">
          {title}
        </h2>
        <p className="mt-1 text-[13px]" style={{ color: "var(--text-secondary)" }}>
          Click a metric to open its list. Ten items per page.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {metrics.map((metric) => (
          <MetricCard
            key={metric.key}
            metric={metric}
            active={activeKey === metric.key}
            onSelect={() => selectMetric(metric.key)}
          />
        ))}
      </div>

      <div
        className="overflow-hidden rounded-[12px] bg-surface"
        style={{ border: "1px solid var(--border)", boxShadow: CARD_SHADOW }}
      >
        <div
          className="flex flex-col gap-1 border-b px-5 py-4 sm:flex-row sm:items-end sm:justify-between sm:px-6"
          style={{ borderColor: "var(--border)" }}
        >
          <div>
            <h3 className="text-[15px] font-semibold tracking-[-0.2px]">{panel.heading}</h3>
            <p className="mt-1 text-[13px]" style={{ color: "var(--text-secondary)" }}>
              {panel.description}
            </p>
          </div>
          <p className="text-[12px] font-medium tabular-nums" style={{ color: "var(--text-tertiary)" }}>
            {total.toLocaleString()}
          </p>
        </div>

        {total === 0 ? (
          <p className="px-5 py-10 text-center text-[13px] sm:px-6" style={{ color: "var(--text-tertiary)" }}>
            {panel.empty}
          </p>
        ) : (
          <>
            <ul className="m-0 list-none divide-y p-0" style={{ borderColor: "var(--border)" }}>
              {pageItems}
            </ul>
            <div className="border-t px-5 py-3 sm:px-6" style={{ borderColor: "var(--border)" }}>
              <PaginationBar
                page={safePage}
                pageCount={pageCount}
                total={total}
                rangeStart={rangeStart}
                rangeEnd={rangeEnd}
                itemLabel="items"
                onPageChange={setPage}
                compact
              />
            </div>
          </>
        )}
      </div>
    </section>
  );
}

export function programListNodes(programs: StaffCreatedProgram[], compact?: boolean): ReactNode[] {
  return programs.map((program) => (
    <li key={program.id} className={listRowClass(compact)}>
      <div className="min-w-0">
        <Link
          href={`/academy/admin/catalog/${program.id}`}
          className={`font-medium text-ink no-underline hover:text-accent ${compact ? "text-[13.5px]" : "text-[14.5px]"}`}
        >
          {program.name.trim() || "Untitled program"}
        </Link>
        <p className={`mt-0.5 ${compact ? "text-[12px]" : "mt-1 text-[12.5px]"}`} style={{ color: "var(--text-tertiary)" }}>
          {program.category || programTypeLabel(program.type)}
          {program.updatedAt ? ` · Updated ${formatWhen(program.updatedAt)}` : ""}
        </p>
      </div>
      <Pill tone={statusTone(program.status)}>{statusLabel(program.status)}</Pill>
    </li>
  ));
}

export function publishRequestListNodes(
  requests: StaffPublishRequest[],
  compact?: boolean,
): ReactNode[] {
  return requests.map((request) => (
    <li key={request.id} className={listRowClass(compact)}>
      <div className="min-w-0">
        <Link
          href={`/academy/admin/catalog/${request.programId}`}
          className={`font-medium text-ink no-underline hover:text-accent ${compact ? "text-[13.5px]" : "text-[14.5px]"}`}
        >
          {request.programName.trim() || "Untitled program"}
        </Link>
        <p className={`mt-0.5 ${compact ? "text-[12px]" : "mt-1 text-[12.5px]"}`} style={{ color: "var(--text-tertiary)" }}>
          {request.at ? formatWhen(request.at) : "No date"}
        </p>
      </div>
      <Pill tone={statusTone(request.status)}>{statusLabel(request.status)}</Pill>
    </li>
  ));
}

export function personListNodes(
  people: StaffPersonRef[],
  hrefFor?: (person: StaffPersonRef) => string,
  compact?: boolean,
): ReactNode[] {
  return people.map((person, index) => {
    const href = hrefFor?.(person) ?? `/academy/admin/instructors/${person.userId}`;
    return (
      <li key={`${person.userId}-${person.at ?? index}`} className={listRowClass(compact)}>
        <div className="min-w-0">
          <Link
            href={href}
            className={`font-medium text-ink no-underline hover:text-accent ${compact ? "text-[13.5px]" : "text-[14.5px]"}`}
          >
            {person.displayName}
          </Link>
          <p
            className={compact ? "mt-0.5 text-[12px]" : "mt-1 text-[12.5px]"}
            style={{ color: "var(--text-tertiary)" }}
          >
            {[person.email, person.at ? formatWhen(person.at) : null].filter(Boolean).join(" · ")}
          </p>
        </div>
      </li>
    );
  });
}

export function assignmentListNodes(
  assignments: StaffAssignmentRef[],
  compact?: boolean,
): ReactNode[] {
  return assignments.map((item) => (
    <li key={item.id} className={listRowClass(compact)}>
      <div className="min-w-0">
        <Link
          href={`/academy/admin/catalog/${item.programId}`}
          className={`font-medium text-ink no-underline hover:text-accent ${compact ? "text-[13.5px]" : "text-[14.5px]"}`}
        >
          {item.programName.trim() || "Untitled program"}
        </Link>
        <p
          className={compact ? "mt-0.5 text-[12px]" : "mt-1 text-[12.5px]"}
          style={{ color: "var(--text-tertiary)" }}
        >
          Assigned to{" "}
          <Link
            href={`/academy/admin/instructors/${item.instructorUserId}`}
            className="text-accent no-underline hover:text-accent-hover"
          >
            {item.instructorName}
          </Link>
          {item.at ? ` · ${formatWhen(item.at)}` : ""}
        </p>
      </div>
    </li>
  ));
}
