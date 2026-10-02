import Link from "next/link";
import { EmptyNote, SectionTitle } from "@/whitbyos/components/EmptyNote";
import { clientKind, money, relativeTime, shortDate } from "@/whitbyos/lib/format";
import { AccountSection } from "@/whitbyos/clients/[id]/tabs/AccountTab";
import type { ClientBilling } from "@/whitbyos/lib/invoices";
import { PreferencesSection } from "@/whitbyos/clients/[id]/tabs/PreferencesTab";
import { WorkSection } from "@/whitbyos/clients/[id]/tabs/WorkTab";
import { ClientStatusField } from "@/whitbyos/clients/[id]/components/ClientStatusField";
import { ProgressBar } from "@/base/components/ProgressBar";
import { AreaChart, Donut, donutSlices } from "@/whitbyos/workspaces/OverviewDashboard";
import type {
  ClientMonthRow,
  ClientPreferences,
  OverviewStats,
  PortalCeiling,
  WeekItem,
  WorkCounts,
} from "@/whitbyos/lib/client-sections";
import type { ClientDetail, ClientRequest, TimelineEntry } from "@/whitbyos/lib/client-detail";
import { requestStatusLabel, requestStatusTone } from "@/whitbyos/lib/request-status";
import { Pill } from "@/base/components/Pill";

const CLOSED = new Set(["complete", "completed", "closed", "cancelled"]);

function softBorder() {
  return "color-mix(in srgb, var(--chrome-line) 85%, #c5ced8)";
}

function panelStyle(): React.CSSProperties {
  return {
    borderColor: softBorder(),
    background: "var(--surface)",
    boxShadow: "0 1px 2px rgba(31,72,125,.04)",
  };
}

/**
 * Screen 2.1's Overview, and the home for the sections the design gives no tab.
 */
export function OverviewTab({
  client,
  requests,
  timeline,
  ownerName,
  work,
  stats,
  week,
  trend,
  preferences,
  ceiling,
  billing,
}: {
  client: ClientDetail & {
    current_summary?: string | null;
    next_action?: string | null;
  };
  requests: ClientRequest[];
  timeline: TimelineEntry[];
  ownerName: string;
  work: WorkCounts;
  stats: OverviewStats;
  week: WeekItem[];
  trend: ClientMonthRow[];
  preferences: ClientPreferences;
  ceiling: PortalCeiling;
  billing: ClientBilling;
}) {
  const open = requests.filter((r) => !CLOSED.has(r.status.toLowerCase()));
  const contact = client.primary_contact;
  const here = `/whitbyos/clients/${client.id}`;

  const weekEvents = week.filter((item) => item.kind === "Event").length;
  const weekRequests = week.filter((item) => item.kind === "Request").length;

  const statusBuckets = bucketStatuses(open);
  const workTotal =
    work.tasks + work.forms + work.messages + work.updates + work.calendar;

  const workSlices = donutSlices([
    { name: "Tasks", value: work.tasks },
    { name: "Messages", value: work.messages },
    { name: "Updates", value: work.updates },
    { name: "Calendar", value: work.calendar },
    { name: "Forms", value: work.forms },
  ]);

  const yearOpened = trend.reduce((sum, month) => sum + month.opened, 0);
  const yearClosed = trend.reduce((sum, month) => sum + month.closed, 0);

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          href={`${here}/requests`}
          label="Requests"
          value={stats.requests}
          note={
            stats.requestsDueThisWeek
              ? `${stats.requestsDueThisWeek} due this week`
              : "None due this week"
          }
          meter={
            stats.requests > 0
              ? (stats.requestsDueThisWeek / stats.requests) * 100
              : 0
          }
        />
        <StatCard
          href="/whitbyos/work-plans"
          label="Work Plans"
          value={stats.workPlans}
          note={
            stats.workPlansActive
              ? `${stats.workPlansActive} active`
              : "No active plans"
          }
          meter={
            stats.workPlans > 0
              ? (stats.workPlansActive / stats.workPlans) * 100
              : 0
          }
        />
        <StatCard
          href={`${here}/documents`}
          label="Documents"
          value={stats.documents}
          note={
            stats.documentsToday
              ? `${stats.documentsToday} uploaded today`
              : "None uploaded today"
          }
          meter={stats.documentsToday > 0 ? 100 : stats.documents > 0 ? 18 : 0}
        />
        <StatCard
          href="/whitbyos/messages"
          label="Messages"
          value={stats.messages}
          note={stats.messages ? "On this client" : "No messages yet"}
          meter={stats.messages > 0 ? Math.min(100, stats.messages * 4) : 0}
        />
      </div>

      <div>
        <div
          className="mb-3 text-[11.5px] font-semibold uppercase tracking-[0.1em]"
          style={{ color: "var(--text-quiet)" }}
        >
          The picture
        </div>
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1.55fr)_minmax(280px,1fr)]">
          <section className="rounded-[12px] border p-5" style={panelStyle()}>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-[13.5px] font-semibold tracking-[-0.1px]">
                  Requests this year
                </h3>
                <p className="mt-0.5 text-[12px]" style={{ color: "var(--text-tertiary)" }}>
                  Opened {yearOpened} · closed {yearClosed}
                </p>
              </div>
              <span
                className="rounded-control border px-2.5 py-[3px] text-[12px]"
                style={{ borderColor: "var(--chrome-line)", color: "var(--text-secondary)" }}
              >
                {new Date().getFullYear()}
              </span>
            </div>
            <AreaChart months={trend} />
          </section>

          <section className="rounded-[12px] border p-5" style={panelStyle()}>
            <h3 className="mb-1 text-[13.5px] font-semibold tracking-[-0.1px]">
              Where the work sits
            </h3>
            <p className="mb-3 text-[12px]" style={{ color: "var(--text-tertiary)" }}>
              Across this client&apos;s requests
            </p>
            <Donut slices={workSlices} total={workTotal} />
          </section>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(220px,0.75fr)_minmax(220px,0.75fr)]">
        <div className="rounded-[12px] border px-4 py-4" style={panelStyle()}>
          <div className="mb-3 flex items-baseline justify-between gap-2">
            <div className="text-[13.5px] font-semibold tracking-[-0.1px]">This Week</div>
            <span className="text-[11.5px]" style={{ color: "var(--text-quiet)" }}>
              {week.length === 0
                ? "Clear"
                : `${week.length} item${week.length === 1 ? "" : "s"}`}
            </span>
          </div>
          {week.length === 0 ? (
            <p className="text-[13px]" style={{ color: "var(--text-tertiary)" }}>
              Nothing due or scheduled this week.
            </p>
          ) : (
            <div className="flex flex-col">
              {week.map((item) => (
                <WeekRow key={item.id} item={item} />
              ))}
            </div>
          )}
        </div>

        <div className="rounded-[12px] border px-4 py-4" style={panelStyle()}>
          <div className="mb-1 text-[13.5px] font-semibold tracking-[-0.1px]">
            Open request mix
          </div>
          <p className="mb-3 text-[11.5px]" style={{ color: "var(--text-quiet)" }}>
            {open.length === 0
              ? "No open requests"
              : `${open.length} open · by status`}
          </p>
          {open.length === 0 ? <EmptyBars /> : <StatusBars buckets={statusBuckets} />}
        </div>

        <div className="rounded-[12px] border px-4 py-4" style={panelStyle()}>
          <div className="mb-1 text-[13.5px] font-semibold tracking-[-0.1px]">
            Billing pulse
          </div>
          <p className="mb-3 text-[11.5px]" style={{ color: "var(--text-quiet)" }}>
            This client&apos;s invoices
          </p>
          <BillingBars billing={billing} href={`${here}/billing`} />
        </div>
      </div>

      {(client.next_action || client.current_summary) && (
        <div className="grid gap-4 lg:grid-cols-2">
          {client.next_action ? (
            <div
              className="relative overflow-hidden rounded-[12px] border px-4 py-4 pl-5"
              style={{
                borderColor: "color-mix(in srgb, var(--accent) 28%, var(--chrome-line))",
                background:
                  "linear-gradient(135deg, var(--accent-tint-mid) 0%, var(--surface) 70%)",
              }}
            >
              <span
                aria-hidden
                className="absolute inset-y-0 left-0 w-[3px]"
                style={{ background: "var(--accent)" }}
              />
              <div
                className="mb-1.5 text-[11.5px] font-semibold uppercase tracking-[.04em]"
                style={{ color: "var(--accent)" }}
              >
                Next action
              </div>
              <p className="text-[13.5px] leading-[1.55]" style={{ color: "var(--info-fg)" }}>
                {client.next_action}
              </p>
            </div>
          ) : null}
          {client.current_summary ? (
            <div className="rounded-[12px] border px-4 py-4" style={panelStyle()}>
              <div
                className="mb-1.5 text-[11.5px] font-semibold uppercase tracking-[.04em]"
                style={{ color: "var(--text-quiet)" }}
              >
                Current summary
              </div>
              <p
                className="text-[13.5px] leading-[1.6]"
                style={{ color: "var(--text-secondary)" }}
              >
                {client.current_summary}
              </p>
            </div>
          ) : null}
        </div>
      )}

      <div className="flex flex-col gap-5 lg:flex-row">
        <div className="min-w-0 flex-1">
          <div className="mb-3 flex items-end justify-between gap-3">
            <SectionTitle>Open Requests</SectionTitle>
            {open.length > 0 ? (
              <Link
                href={`${here}/requests`}
                className="mb-1 shrink-0 text-[12.5px] font-medium no-underline"
                style={{ color: "var(--accent)" }}
              >
                All requests →
              </Link>
            ) : null}
          </div>
          {open.length === 0 ? (
            <div className="rounded-[12px] border px-5 py-6" style={panelStyle()}>
              <EmptyNote>No open requests for this client yet.</EmptyNote>
            </div>
          ) : (
            <div className="overflow-hidden rounded-[12px] border" style={panelStyle()}>
              {open.slice(0, 6).map((request) => (
                <Link
                  key={request.id}
                  href={`/whitbyos/requests/${request.id}`}
                  className="flex items-center gap-3 border-b px-4 py-3.5 no-underline last:border-b-0 hover:bg-[var(--surface-soft)]"
                  style={{ borderColor: "var(--chrome-line)" }}
                >
                  <Pill tone={requestStatusTone(request.status)}>
                    {requestStatusLabel(request.status)}
                  </Pill>
                  <span
                    className="min-w-0 flex-1 truncate text-[14px] font-medium"
                    style={{ color: "var(--ink)" }}
                  >
                    {request.title}
                  </span>
                  {request.target_date ? (
                    <span className="shrink-0 text-[12.5px]" style={{ color: "var(--text-tertiary)" }}>
                      Due {shortDate(request.target_date)}
                    </span>
                  ) : null}
                </Link>
              ))}
            </div>
          )}

          <div className="mt-6">
            <WorkSection counts={work} total={workTotal} />
          </div>
        </div>

        <div className="w-full shrink-0 lg:w-[300px]">
          <SectionTitle>Profile</SectionTitle>
          <div className="mb-5 overflow-hidden rounded-[12px] border" style={panelStyle()}>
            <Row label="Classification">{clientKind(client)}</Row>
            <Row label="Status">
              <ClientStatusField clientId={client.id} value={client.status} />
            </Row>
            <Row label="Owner">{ownerName}</Row>
            {contact?.email ? <Row label="Email">{contact.email}</Row> : null}
            {contact?.phone ? <Row label="Phone">{contact.phone}</Row> : null}
            {contact?.timezone ? <Row label="Timezone">{contact.timezone}</Row> : null}
            {!contact?.email && !contact?.phone ? (
              <div className="px-4 py-3 text-[13px]" style={{ color: "var(--text-tertiary)" }}>
                No contact details recorded.
              </div>
            ) : null}
          </div>

          <div className="mb-5 rounded-[12px] border px-4 py-4" style={panelStyle()}>
            <div className="mb-1 text-[13.5px] font-semibold">This week split</div>
            <p className="mb-3 text-[11.5px]" style={{ color: "var(--text-quiet)" }}>
              Requests vs events
            </p>
            <WeekDonut requests={weekRequests} events={weekEvents} />
          </div>

          <SectionTitle>Recent Activity</SectionTitle>
          <div className="mb-5 overflow-hidden rounded-[12px] border" style={panelStyle()}>
            {timeline.length === 0 ? (
              <p className="px-4 py-3.5 text-[13px]" style={{ color: "var(--text-tertiary)" }}>
                Nothing recorded yet.
              </p>
            ) : (
              timeline.slice(0, 5).map((entry) => (
                <div
                  key={entry.id}
                  className="border-b px-4 py-3 last:border-b-0"
                  style={{ borderColor: "var(--chrome-line)" }}
                >
                  <div className="text-[13px] leading-[1.45]">{entry.description}</div>
                  <div className="mt-0.5 text-[11.5px]" style={{ color: "var(--text-quiet)" }}>
                    {relativeTime(entry.created_at)}
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="mb-5">
            <PreferencesSection preferences={preferences} />
          </div>

          <AccountSection
            ceiling={ceiling}
            ownerName={ownerName}
            billing={billing}
            billingHref={`/whitbyos/clients/${client.id}/billing`}
          />
        </div>
      </div>
    </div>
  );
}

function BillingBars({
  billing,
  href,
}: {
  billing: ClientBilling;
  href: string;
}) {
  const paid = billing.paidThisYearCents;
  const due = billing.outstandingCents;
  const max = Math.max(paid, due, 1);

  return (
    <Link href={href} className="flex flex-col gap-3 no-underline" style={{ color: "inherit" }}>
      <div>
        <div className="mb-1 flex justify-between text-[12px]">
          <span style={{ color: "var(--text-muted)" }}>Outstanding</span>
          <span className="font-semibold tabular-nums">
            {money(due, billing.currency)}
          </span>
        </div>
        <div className="h-2.5 overflow-hidden rounded-full" style={{ background: "var(--surface-soft)" }}>
          <div
            className="h-full rounded-full"
            style={{
              width: `${(due / max) * 100}%`,
              background: due > 0 ? "var(--warning-fg)" : "var(--accent)",
              minWidth: due > 0 ? 6 : 0,
            }}
          />
        </div>
      </div>
      <div>
        <div className="mb-1 flex justify-between text-[12px]">
          <span style={{ color: "var(--text-muted)" }}>Paid this year</span>
          <span className="font-semibold tabular-nums">
            {money(paid, billing.currency)}
          </span>
        </div>
        <div className="h-2.5 overflow-hidden rounded-full" style={{ background: "var(--surface-soft)" }}>
          <div
            className="h-full rounded-full"
            style={{
              width: `${(paid / max) * 100}%`,
              background: "var(--success-fg)",
              minWidth: paid > 0 ? 6 : 0,
            }}
          />
        </div>
      </div>
      <div className="text-[11.5px]" style={{ color: "var(--text-quiet)" }}>
        {billing.count} invoice{billing.count === 1 ? "" : "s"}
        {billing.draftCount > 0 ? ` · ${billing.draftCount} draft` : ""}
        {billing.overdueCount > 0 ? ` · ${billing.overdueCount} overdue` : ""}
      </div>
    </Link>
  );
}

function WeekRow({ item }: { item: WeekItem }) {
  const when = new Date(item.when);
  const valid = !Number.isNaN(when.getTime());
  const month = valid
    ? when.toLocaleDateString("en-US", { month: "short" })
    : "—";
  const day = valid ? String(when.getDate()) : "—";

  return (
    <Link
      href={item.href}
      className="grid grid-cols-[4.5rem_minmax(0,1fr)_auto] items-center gap-3 border-b py-2.5 no-underline last:border-b-0"
      style={{ borderColor: "var(--chrome-line)", color: "var(--ink)" }}
    >
      <span
        className="inline-flex h-8 items-center justify-center gap-1 rounded-[8px] px-2 text-[11.5px] font-semibold tabular-nums"
        style={{
          background: "var(--accent-tint)",
          color: "var(--accent)",
        }}
      >
        <span>{month}</span>
        <span>{day}</span>
      </span>
      <span className="min-w-0 truncate text-[13.5px] font-medium leading-snug">
        {item.label}
      </span>
      <span
        className="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium"
        style={{
          background: "var(--surface-soft)",
          color: "var(--text-muted)",
        }}
      >
        {item.kind}
      </span>
    </Link>
  );
}

function StatCard({
  href,
  label,
  value,
  note,
  meter,
}: {
  href: string;
  label: string;
  value: number;
  note: string;
  meter: number;
}) {
  return (
    <Link
      href={href}
      className="group flex flex-col gap-1.5 rounded-[12px] border px-4 py-3.5 no-underline transition-colors hover:bg-[var(--surface-soft)]"
      style={{ ...panelStyle(), color: "inherit" }}
    >
      <span
        className="text-[11px] font-semibold uppercase tracking-[0.04em]"
        style={{ color: "var(--text-quiet)" }}
      >
        {label}
      </span>
      <span className="text-[22px] font-bold tracking-[-0.4px]">{value}</span>
      <ProgressBar value={meter} />
      <span className="text-[11.5px]" style={{ color: "var(--text-tertiary)" }}>
        {note}
      </span>
    </Link>
  );
}

function bucketStatuses(open: ClientRequest[]) {
  const map = new Map<string, number>();
  for (const request of open) {
    const label = requestStatusLabel(request.status);
    map.set(label, (map.get(label) ?? 0) + 1);
  }
  return [...map.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);
}

function StatusBars({ buckets }: { buckets: { label: string; count: number }[] }) {
  const max = Math.max(...buckets.map((row) => row.count), 1);
  return (
    <div className="flex flex-col gap-2.5">
      {buckets.map((row) => (
        <div key={row.label}>
          <div className="mb-1 flex items-baseline justify-between gap-2 text-[12px]">
            <span className="truncate font-medium">{row.label}</span>
            <span className="tabular-nums" style={{ color: "var(--text-tertiary)" }}>
              {row.count}
            </span>
          </div>
          <div
            className="h-2 overflow-hidden rounded-full"
            style={{ background: "var(--surface-soft)" }}
          >
            <div
              className="h-full rounded-full"
              style={{
                width: `${(row.count / max) * 100}%`,
                background: "var(--accent)",
                opacity: 0.55 + (row.count / max) * 0.45,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyBars() {
  return (
    <div className="flex h-[110px] flex-col justify-end gap-2 opacity-40">
      {[40, 65, 28].map((height, i) => (
        <div
          key={i}
          className="rounded-full"
          style={{ height: 8, width: `${height}%`, background: "var(--chrome-line)" }}
        />
      ))}
    </div>
  );
}

function WeekDonut({ requests, events }: { requests: number; events: number }) {
  const total = requests + events;
  if (total === 0) {
    return (
      <div className="flex h-[120px] items-center justify-center">
        <span className="text-[12.5px]" style={{ color: "var(--text-tertiary)" }}>
          Quiet week
        </span>
      </div>
    );
  }

  const size = 108;
  const stroke = 14;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const reqLen = (requests / total) * c;
  const evtLen = (events / total) * c;

  return (
    <div className="flex items-center gap-3">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden className="shrink-0">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--surface-soft)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--accent)"
          strokeWidth={stroke}
          strokeDasharray={`${reqLen} ${c - reqLen}`}
          strokeDashoffset={c / 4}
          strokeLinecap="butt"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--avatar-tan-fg)"
          strokeWidth={stroke}
          strokeDasharray={`${evtLen} ${c - evtLen}`}
          strokeDashoffset={c / 4 - reqLen}
          strokeLinecap="butt"
          opacity={0.85}
        />
        <text
          x="50%"
          y="48%"
          textAnchor="middle"
          dominantBaseline="central"
          style={{ fontSize: 18, fontWeight: 700, fill: "var(--ink)" }}
        >
          {total}
        </text>
        <text
          x="50%"
          y="62%"
          textAnchor="middle"
          dominantBaseline="central"
          style={{ fontSize: 9, fill: "var(--text-tertiary)" }}
        >
          items
        </text>
      </svg>
      <div className="flex min-w-0 flex-col gap-2 text-[12px]">
        <LegendDot color="var(--accent)" label="Requests" value={requests} />
        <LegendDot color="var(--avatar-tan-fg)" label="Events" value={events} />
      </div>
    </div>
  );
}

function LegendDot({
  color,
  label,
  value,
}: {
  color: string;
  label: string;
  value: number;
}) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className="h-2 w-2 rounded-[2px]" style={{ background: color }} aria-hidden />
      <span style={{ color: "var(--text-muted)" }}>{label}</span>
      <span className="font-semibold tabular-nums">{value}</span>
    </span>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div
      className="flex items-center justify-between gap-3 border-b px-4 py-3 last:border-b-0"
      style={{ borderColor: "var(--chrome-line)" }}
    >
      <span className="shrink-0 text-[12.5px]" style={{ color: "var(--text-tertiary)" }}>
        {label}
      </span>
      <span className="min-w-0 truncate text-right text-[13px] font-medium">{children}</span>
    </div>
  );
}
