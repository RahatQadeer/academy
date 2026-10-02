import { SubmitPlain } from "@/base/components/Submit";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Button } from "@/base/components/Button";
import { Callout } from "@/base/components/Callout";
import { StateMessage } from "@/whitbyos/components/StateMessage";
import { AddClientDialog } from "@/whitbyos/clients/components/AddClientDialog";
import { Modal } from "@/whitbyos/components/Modal";
import { archiveClient } from "@/whitbyos/clients/actions";
import { getWorkspaceOverview } from "@/whitbyos/lib/workspace-overview";
import { getSessionProfile } from "@/base/identity/session";
import { getSettingsProfile, getWorkspaceSettings } from "@/whitbyos/lib/settings";
import { isSupabaseConfigured } from "@/base/lib/supabase/server";
import { getWorkspaceLogoUrl } from "@/base/lib/logo";
import { needsOnboarding } from "@/whitbyos/lib/onboarding";
import { param, type SearchParams } from "@/whitbyos/lib/params";
import { getCurrentWorkspaceId } from "@/whitbyos/lib/workspace";
import { getOpenClientId } from "@/whitbyos/lib/open-client";
import { usesClientWorkspaces } from "@/whitbyos/lib/client-workspace";
import { NotificationBell } from "@/whitbyos/components/NotificationBell";
import { listNotices, unreadIn } from "@/whitbyos/lib/notifications";
import { OrgMenu } from "@/whitbyos/workspaces/OrgMenu";
import { OverviewDashboard, donutSlices } from "@/whitbyos/workspaces/OverviewDashboard";
import { OverviewLanding } from "@/whitbyos/workspaces/OverviewLanding";
import { OverviewShell } from "@/whitbyos/workspaces/OverviewShell";
import { WatchDemo } from "@/whitbyos/workspaces/WatchDemo";
import { WorkspaceRailList } from "@/whitbyos/workspaces/WorkspaceRailList";
import { cn } from "@/base/lib/cn";
import { faceFor, initialsOf } from "@/whitbyos/lib/client-face";
import { getOverviewBoard } from "@/whitbyos/lib/overview-board";
import { getHomeWidgets } from "@/whitbyos/lib/home-widgets";
import { relativeTime } from "@/whitbyos/lib/format";
import { Logo } from "@/base/components/Logo";

const HERE = "/whitbyos/workspaces";

const STAT_TONES = {
  blue: {
    bg: "var(--accent-tint)",
    chip: "var(--accent-tint)",
    fg: "var(--accent)",
    bar: "var(--accent)",
  },
  green: {
    bg: "#f4f8f5",
    chip: "var(--success-bg)",
    fg: "var(--success-fg)",
    bar: "var(--success-dot)",
  },
  amber: {
    bg: "var(--warning-bg)",
    chip: "#f2e2ca",
    fg: "var(--warning-fg)",
    bar: "#c4893b",
  },
  rose: {
    bg: "var(--danger-bg)",
    chip: "#ffe2dd",
    fg: "var(--danger-text)",
    bar: "var(--danger-solid)",
  },
} as const;

/** One coloured reading — a card of its own, not a cell in a strip. */
function Stat({
  value,
  label,
  note,
  href,
  tone = "blue",
  glyph,
  fill,
  spark,
}: {
  value: number;
  label: string;
  note?: string;
  href?: string;
  tone?: keyof typeof STAT_TONES;
  glyph: string;
  fill?: { value: number; of: number };
  spark?: number[];
}) {
  const palette = STAT_TONES[tone];
  const sparkOn = Boolean(spark && spark.some((n) => n > 0));
  const body = (
    <>
      <span className="flex items-start justify-between gap-2">
        <span
          aria-hidden
          className="flex h-6 w-6 items-center justify-center rounded-[6px] text-[11px]"
          style={{
            background: `color-mix(in srgb, ${palette.chip} 55%, white)`,
            color: palette.fg,
            boxShadow: `0 0 0 1px color-mix(in srgb, ${palette.bar} 12%, transparent)`,
          }}
        >
          {glyph}
        </span>
        {sparkOn && spark ? <Spark values={spark} color={palette.bar} /> : null}
      </span>
      <span className="mt-1.5 text-[18px] font-semibold leading-none tracking-[-0.4px] tabular-nums">
        {value}
      </span>
      <span className="mt-0.5 text-[11.5px] font-medium leading-tight">{label}</span>
      <span
        className="mt-0.5 min-h-[13px] text-[10.5px] leading-tight"
        style={{ color: "var(--text-quiet)" }}
        aria-hidden={note ? undefined : true}
      >
        {note ?? "\u00a0"}
      </span>
      <span className="mt-auto pt-1">
        {fill && fill.of > 0 ? (
          <span
            className="block h-[4px] overflow-hidden rounded-full"
            style={{ background: "color-mix(in srgb, var(--ink) 8%, transparent)" }}
          >
            <span
              className="block h-full rounded-full"
              style={{
                width: `${Math.min(100, Math.max(8, (fill.value / fill.of) * 100))}%`,
                background: palette.bar,
              }}
            />
          </span>
        ) : (
          <span className="block h-[4px]" />
        )}
      </span>
    </>
  );

  const frame = {
    ["--ws-stat-tint" as string]: palette.bg,
    ["--ws-stat-bar" as string]: palette.bar,
    borderColor: `color-mix(in srgb, ${palette.bar} 12%, var(--chrome-line))`,
    color: "var(--ink)",
  };

  if (href) {
    return (
      <Link
        href={href}
        /* 118px was a card and a half of air under four short lines, and
           four of them took a third of the screen before anything with work
           in it. These are counts, not panels. */
        className="ws-stat flex h-full min-h-[78px] w-full flex-col rounded-[10px] border px-2.5 pb-2 pt-2 no-underline transition-transform hover:-translate-y-px"
        style={frame}
      >
        {body}
      </Link>
    );
  }

  return (
    <div
      className="ws-stat flex h-full min-h-[78px] w-full flex-col rounded-[10px] border px-2.5 pb-2 pt-2"
      style={frame}
    >
      {body}
    </div>
  );
}

function Spark({ values, color }: { values: number[]; color: string }) {
  const max = Math.max(1, ...values);
  const w = 64;
  const h = 22;
  const coords = values.map((value, index) => {
    const x = (index / Math.max(1, values.length - 1)) * w;
    const y = h - (value / max) * (h - 6) - 3;
    return { x, y };
  });
  const line = coords.map(({ x, y }) => `${x},${y}`).join(" ");
  const area = `0,${h} ${line} ${w},${h}`;

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden className="shrink-0">
      <polyline fill={color} fillOpacity="0.18" stroke="none" points={area} />
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={line}
      />
    </svg>
  );
}

/**
 * One widget.
 *
 * A mark, a name, a figure where there is one worth reading at a glance, what
 * it holds, and the way to the rest. The figure is red only when it is a
 * number of problems and that number is not nil — a red 0 is a false alarm,
 * and a screen that cries wolf in grey is not read at all.
 */
const PANEL_TONES = {
  quiet: { bg: "var(--surface-soft)", fg: "var(--text-tertiary)" },
  blue: { bg: "var(--accent-tint)", fg: "var(--accent)" },
  green: { bg: "var(--success-bg)", fg: "var(--success-fg)" },
  amber: { bg: "var(--warning-bg)", fg: "var(--warning-fg)" },
  violet: { bg: "var(--module-academy-bg)", fg: "var(--module-academy-fg)" },
  tan: { bg: "var(--avatar-tan-bg)", fg: "var(--avatar-tan-fg)" },
} as const;

function Panel({
  glyph,
  title,
  count,
  tone = "quiet",
  mark = "quiet",
  href,
  more,
  className,
  children,
}: {
  glyph: string;
  title: string;
  count?: number;
  /** Danger is the page's one red, and only when the count is not nil. */
  tone?: "danger" | "quiet";
  /**
   * The mark's own colourway.
   *
   * Eight grey chips in a column made every widget look like the same widget
   * — the eye had nothing to tell "the diary" from "what people said" by
   * except reading each heading. A colour per family is a thing you learn
   * once and then navigate by.
   */
  mark?: keyof typeof PANEL_TONES;
  href?: string;
  more?: string;
  className?: string;
  children: React.ReactNode;
}) {
  const loud = tone === "danger" && (count ?? 0) > 0;

  return (
    <section
      className={cn("ws-panel flex min-h-[240px] w-full flex-col rounded-[12px] border p-4", className)}
      /*
       * The red says what is wrong, it does not outline the box.
       *
       * This card wore a red border and a hard 3px red edge down its left
       * side, which frames the panel as broken rather than the eight rows
       * inside it as late — and the rows already say so, in red, each with
       * its own number of days. The card ends up shouting the loudest thing
       * on the screen about news its own contents have already given.
       *
       * The count and the mark keep their red. The frame is the frame.
       */
      style={{ borderColor: "var(--chrome-line)" }}
    >
      <div className="mb-3 flex items-center justify-between gap-3 border-b border-line pb-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <span
            aria-hidden
            className="flex h-[24px] w-[24px] shrink-0 items-center justify-center rounded-[7px] text-[11px]"
            style={
              loud
                ? { background: "var(--danger-bg)", color: "var(--danger-action-fg)" }
                : { background: PANEL_TONES[mark].bg, color: PANEL_TONES[mark].fg }
            }
          >
            {glyph}
          </span>
          <h3 className="truncate text-[13.5px] font-semibold">{title}</h3>
        </div>

        {typeof count === "number" ? (
          <span
            className="text-[19px] font-bold leading-none tabular-nums"
            style={{ color: loud ? "var(--danger-text)" : "var(--text-quiet)" }}
          >
            {count}
          </span>
        ) : null}
      </div>

      {/* Divided rather than spaced. A column of two-line rows with nothing
          between them reads as one paragraph; a hairline makes each a row. */}
      <div className="flex flex-1 flex-col divide-y divide-[var(--border)]">{children}</div>

      {href ? (
        <Link
          href={href}
          className="mt-3.5 text-[12px] no-underline"
          style={{ color: "var(--accent)" }}
        >
          {more ?? "Open"} →
        </Link>
      ) : null}
    </section>
  );
}

/**
 * A line in a widget: what it is, whose it is, and one thing on the right —
 * how late, or how long ago. The whole line is the target, because half a row
 * being clickable is a row people click the wrong half of.
 */
function Line({
  title,
  note,
  at,
  href,
  clientId,
  face,
  trailing,
  tone,
}: {
  title: string;
  note: string;
  at?: string | null;
  href: string;
  /** Whose it is. Opened on the way, so the rail agrees with the screen. */
  clientId?: string | null;
  /** Whoever wrote it — a photograph where there is one, initials otherwise. */
  face?: { name: string; photo?: string | null };
  trailing?: string;
  tone?: "danger";
}) {
  return (
    <Link
      href={into(href, clientId)}
      className="-mx-2 flex items-start gap-2.5 rounded-[6px] px-2 py-[7px] no-underline transition-colors hover:bg-[var(--surface-soft)]"
      style={{ color: "var(--ink)" }}
    >
      {face ? (
        <span
          aria-hidden
          className="mt-[3px] flex h-[22px] w-[22px] shrink-0 items-center justify-center overflow-hidden rounded-full text-[9px] font-bold"
          style={faceFor(face.name)}
        >
          {face.photo ? (
            // Signed URL on a private bucket, which the optimiser cannot fetch.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={face.photo}
              alt=""
              className="h-full w-full object-cover"
              referrerPolicy="no-referrer"
            />
          ) : (
            initialsOf(face.name)
          )}
        </span>
      ) : null}

      <span className="min-w-0 flex-1">
      <span className="flex items-baseline gap-3">
        <span className="min-w-0 flex-1 truncate text-[13px]">{title}</span>
        {trailing || at ? (
          <span
            className="shrink-0 text-[11.5px] tabular-nums"
            style={{ color: tone === "danger" ? "var(--danger-text)" : "var(--text-quiet)" }}
          >
            {trailing ?? relativeTime(at ?? null)}
          </span>
        ) : null}
      </span>
      <span
        className="block truncate text-[11.5px]"
        style={{ color: "var(--text-tertiary)" }}
      >
        {note}
      </span>
      </span>
    </Link>
  );
}

/**
 * A figure counted across the firm, and the screen it was counted from. Clears
 * the open client on the way, so what lands matches what was claimed.
 */
function everywhere(href: string) {
  return `/api/whitbyos/open?client=all&to=${encodeURIComponent(href)}`;
}

/**
 * The address of a thing on this screen, which is the thing *and* the client
 * workspace it lives in. Rows with no client keep the choice as it is.
 */
function into(href: string, clientId?: string | null) {
  if (!clientId) return href;
  return `/api/whitbyos/open?client=${clientId}&to=${encodeURIComponent(href)}`;
}

/** A count with somewhere to go — the small end of the board. */
function Tally({
  glyph,
  label,
  value,
  note,
  alert,
  href,
}: {
  glyph: string;
  label: string;
  value: number;
  note: string;
  alert?: boolean;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="-mx-2 flex items-center gap-2.5 rounded-[6px] px-2 py-2.5 no-underline transition-colors hover:bg-[var(--surface-soft)]"
      style={{ color: "var(--ink)" }}
    >
      <span aria-hidden className="w-[16px] shrink-0 text-[12px]" style={{ color: "var(--text-quiet)" }}>
        {glyph}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[13px]">{label}</span>
        <span
          className="block truncate text-[11.5px]"
          style={{ color: alert ? "var(--danger-text)" : "var(--text-tertiary)" }}
        >
          {note}
        </span>
      </span>
      <span className="shrink-0 text-[15px] font-semibold tabular-nums">{value}</span>
    </Link>
  );
}

/**
 * What a widget says when it is empty, which on this screen is usually good
 * news rather than a gap — so it reads as an answer and not as a hole.
 */
function Empty({ line, note }: { glyph?: string; line: string; note?: string }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 py-8 text-center">
      <span className="text-[13px] leading-snug" style={{ color: "var(--text-secondary)" }}>
        {line}
      </span>
      {note ? (
        <span className="mt-1 max-w-[280px] text-[12px] leading-snug" style={{ color: "var(--text-quiet)" }}>
          {note}
        </span>
      ) : null}
    </div>
  );
}

/**
 * Screen 0.9 — Workspace Overview.
 *
 * Every Client Workspace in the organization with how each is doing, and the
 * plan's active limit counted against them. Archiving is what frees a slot,
 * which is why the archive control lives on the card rather than three screens
 * away in Settings.
 *
 * The reference calls this the first screen after sign-in, before Home.
 * Switcher and onboarding still run first; this is only where Whitby opens.
 */
export default async function WorkspaceOverviewPage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  if (isSupabaseConfigured() && (await needsOnboarding())) {
    redirect("/onboarding/account");
  }

  const params = searchParams;
  const error = param(params, "error");
  const archiving = param(params, "archive");

  /*
   * Making a client workspace happens here.
   *
   * The three buttons that offer it used to send somebody to the Clients
   * list with `new=1`, and that list is a screen about whichever workspace is
   * already open — so deciding to add a client took you into one. The dialog
   * opens over this screen instead, which is where somebody is standing when
   * they decide there should be another.
   */
  const adding = param(params, "new") === "1";

  const [overview, board, widgets, settings, notices] = await Promise.all([
    getWorkspaceOverview(),
    getOverviewBoard(),
    getHomeWidgets(),
    getWorkspaceSettings(),
    /* This screen sits over the product rather than inside it, so the top
       bar with the bell on it is not there. Without this, anything raised
       while somebody is on the overview is only found by leaving it. */
    listNotices(),
  ]);
  const openClientId = await getOpenClientId();
  const showClients = await usesClientWorkspaces();

  /*
   * One list, from the two places a thing can be late.
   *
   * A Request past its date and a task past its date are the same news to
   * whoever is reading this, and two panels each showing half of it is how
   * somebody misses the half they did not look at. Requests first: a late
   * Request is usually a late task with a client waiting behind it.
   */
  const attention = [
    ...widgets.outstanding.map((row) => ({
      id: `request-${row.id}`,
      title: row.title,
      note: row.client,
      flag: row.note,
      href: `/whitbyos/requests/${row.id}`,
      clientId: row.clientId,
    })),
    ...board.tasks.rows
      .filter((row) => row.late !== null && row.late > 0)
      .map((row) => ({
        id: `task-${row.id}`,
        title: row.title,
        note: row.note,
        flag: `${row.late}d late`,
        href: row.href,
        clientId: row.clientId,
      })),
  ];

  const workSlices = donutSlices(
    showClients
      ? (overview?.cards ?? []).map((card) => ({ name: card.name, value: card.activeRequests }))
      : [
          { name: "Requests", value: overview?.activeRequests ?? 0 },
          { name: "Tasks", value: board.tasks.open },
          { name: "Documents", value: board.documents.total },
          { name: "Forms", value: board.forms.total },
        ],
  );
  const topClients = [...(overview?.cards ?? [])]
    .sort((a, b) => b.activeRequests - a.activeRequests)
    .slice(0, 3)
    .map((card) => ({ name: card.name, value: card.activeRequests }));
  const recent = [
    ...board.events.map((event) => ({
      id: `event-${event.id}`,
      title: event.title,
      note: [event.day, event.time].filter(Boolean).join(" · "),
      href: "/whitbyos/calendar",
      at: event.at,
    })),
    ...board.messages.map((row) => ({
      id: `msg-${row.id}`,
      title: row.title,
      note: row.note,
      href: row.href,
      at: row.at,
    })),
    ...board.updates.map((row) => ({
      id: `upd-${row.id}`,
      title: row.title,
      note: row.note,
      href: row.href,
      at: row.at,
    })),
  ]
    .sort((a, b) => Date.parse(b.at ?? "") - Date.parse(a.at ?? ""))
    .slice(0, 4)
    .map(({ at: _at, ...row }) => row);

  const profile = await getSessionProfile();
  const currentId = await getCurrentWorkspaceId();
  const org =
    (profile?.workspaces ?? []).find((workspace) => workspace.id === currentId) ??
    profile?.workspaces[0];
  const orgName = org?.name || "Your organization";
  const orgLogo = await getWorkspaceLogoUrl(org?.logo_url);

  /*
   * Whose account is looking at this.
   *
   * The masthead named the firm and showed its mark, and said nothing about
   * the person — on the one screen in the product that is not inside a
   * client, where the account is the only other thing on it.
   */
  const settingsProfile = await getSettingsProfile();
  const me = {
    name:
      settingsProfile?.fullName ||
      profile?.user.preferred_name ||
      profile?.user.full_name ||
      "Your account",
    photo: settingsProfile?.avatarUrl ?? profile?.user.avatar_url ?? null,
    initials: settingsProfile?.initials ?? "?",
    roleLabel: settingsProfile?.roleLabel ?? "Member",
  };


  if (!overview) {
    return (
      <div className="px-5 py-6 sm:px-8 sm:py-9 xl:px-12">
        <StateMessage
          glyph="◔"
          title="No organization yet"
          description="Finish setting up your organization before opening a workspace."
          action={
            <Button href="/onboarding/account" variant="primary">
              Continue setup
            </Button>
          }
        />
      </div>
    );
  }

  const atLimit =
    overview.limit !== null && overview.active >= overview.limit;
  const target = archiving
    ? overview.cards.find((row) => row.id === archiving)
    : undefined;

  return (
    /*
     * The whole window, from the page rather than from the layout.
     *
     * This screen wants no rail: the one decision on it is which client's work
     * you are about to look at, and a rail offering seventeen screens *inside*
     * a workspace nobody has chosen yet answers a question with the question
     * still on the table.
     *
     * Hiding it from `app/[product]/layout.tsx` was the obvious way and the
     * wrong one. A layout does not re-render when you navigate between two
     * pages that share it, so the bare layout rendered for this screen stayed
     * bare on the next — opening a conversation from here landed on Messages
     * with no rail, no bar, and a panel adrift in the corner.
     *
     * A cover, laid over the shell by the page that wants it, cannot do that:
     * it leaves with the page. The shell is still mounted behind it, which is
     * exactly why it is there again the moment you go anywhere.
     *
     * The overview fills whatever is left of the window once the rail is
     * open or closed — it stays on the left, not a centred island.
     */
    <OverviewShell
      showRail={showClients}
      brand={
        /*
         * Whose product, and then whose organization.
         *
         * This corner showed the firm's own logo and the word Organization,
         * and nothing on the screen said what the thing they were looking
         * at was. It is the first screen anybody lands on and the one they
         * would send a colleague a picture of; it should carry the name of
         * the product as well as the name of the firm.
         *
         * The product's mark sits above, small and quiet, and the firm's
         * name has the weight — it is their screen, not ours.
         */
        /* Whose software this is, at the head of the rail. The firm goes
           at the foot — see `org`. */
        /* The mark in a tile of its own, so it sits on the rail's colour
           rather than floating over it. The line under it says which
           product this is, rather than repeating the heading on the right
           — which is what it used to do. */
        <div className="flex min-w-0 items-center gap-2.5">
          {/* Big enough to be recognised as the mark rather than read as a
              bullet. It is the only place on this screen that says whose
              software this is. */}
          <span
            className="flex h-[42px] w-[42px] shrink-0 items-center justify-center overflow-hidden rounded-[11px]"
            style={{
              background: "rgba(255,255,255,.92)",
              boxShadow: "0 1px 3px rgba(23,48,78,.12), inset 0 0 0 1px rgba(255,255,255,.75)",
            }}
          >
            <Logo size={33} className="rounded-[8px]" />
          </span>
          <div className="ws-rail-copy min-w-0">
            {/* The head of the rail is the only place on this screen that
                says whose software this is, and it was set smaller than a
                client's name four rows below it — which put the product
                under the people using it. */}
            <p className="truncate text-[16px] font-semibold leading-tight tracking-[-0.25px]">
              Private Attaché
            </p>
            <p
              className="mt-[2px] truncate text-[11.5px] leading-tight"
              style={{ color: "var(--text-tertiary)" }}
            >
              Every client, one place
            </p>
          </div>
        </div>
      }
      org={
        /*
         * The firm, at the foot, where a product puts the account somebody
         * is signed in as — and where it sits beside the button that makes
         * another workspace for it.
         */
        <div className="flex min-w-0 items-center gap-2.5" title={orgName}>
          <span
            className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden text-[12px] font-semibold"
            style={{
              background: orgLogo ? "var(--surface)" : "var(--ink)",
              color: "#ffffff",
              borderRadius: 7,
              boxShadow: "inset 0 0 0 1px var(--chrome-line)",
            }}
            aria-hidden
          >
            {orgLogo ? (
              // Signed URL on a private bucket, so the optimiser cannot fetch it.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={orgLogo} alt="" className="h-full w-full object-cover" />
            ) : (
              initialsOf(orgName)
            )}
          </span>
          <div className="ws-rail-copy min-w-0">
            <p className="truncate text-[13px] font-semibold leading-tight tracking-[-0.15px]">
              {orgName}
            </p>
            <p
              className="mt-[1px] truncate text-[11px] leading-tight"
              style={{ color: "var(--text-tertiary)" }}
            >
              Organization
            </p>
          </div>
        </div>
      }
      headerLeft={
        <div className="flex min-w-0 items-center gap-2.5">
          <h1 className="truncate text-[18px] font-semibold leading-tight tracking-[-0.35px]">
            Workspace overview
          </h1>
          {/* The plan, as a chip, the way the product's own bar wears it
              beside the firm's name. It was only on this screen inside a
              stat card, as the small print under a count of workspaces. */}
          <span
            className="hidden shrink-0 rounded-full px-2 py-[3px] text-[10px] font-semibold uppercase tracking-[0.07em] sm:inline-block"
            style={{ background: "var(--accent-tint)", color: "var(--accent)" }}
          >
            {overview.planLabel}
          </span>
        </div>
      }
      headerRight={
        <div className="flex items-center gap-2.5">
          {/* The same bell as the product's bar. This screen sits over the
              product rather than inside it, so there was no bell at all
              here: anything raised while somebody was on the overview
              could only be found by leaving it. */}
          <NotificationBell
            notices={notices}
            unread={unreadIn(notices)}
            here="/whitbyos/workspaces"
          />

          {/* Making a workspace is the thing this screen is for, so it sits
              on the bar beside the account rather than at the bottom of a
              rail somebody has to scroll a list to reach. */}
          {showClients && !atLimit ? (
            <>
              {/* The same accented `+` the product's own bar uses for quick
                  add. The label it had spelled out what the plus already
                  says, in the widest control on a bar with four things on
                  it — and what it says is still there for anyone who cannot
                  read a glyph, on the button rather than beside it. */}
              <Link
                href="/whitbyos/workspaces?new=1"
                aria-label="Create workspace"
                title="Create workspace"
                className="pa-bar-btn pa-bar-accent text-[18px] leading-none no-underline"
              >
                <span aria-hidden>+</span>
              </Link>

              {/* The button is the thing to do on this screen; the avatar is
                  the way out of it. On one small gap they read as a pair of
                  controls that belong together, which they do not. */}
              <span
                aria-hidden
                className="hidden h-5 w-px sm:block"
                style={{ background: "color-mix(in srgb, var(--accent) 20%, transparent)" }}
              />
            </>
          ) : null}
          <OrgMenu
            userName={me.name}
            userPhoto={me.photo}
            userInitials={me.initials}
            userRole={me.roleLabel}
          />
        </div>
      }
      banner={
        error ? (
          <div className="shrink-0 px-5 pt-4">
            <Callout tone="danger">{error}</Callout>
          </div>
        ) : null
      }
      railEyebrow="Workspaces"
      railNote={`${overview.cards.length} open`}
      rail={
        showClients ? (
          <WorkspaceRailList
            cards={overview.cards.map((card) => ({
              id: card.id,
              name: card.name,
              photo: card.photo,
              activeRequests: card.activeRequests,
              portal: card.portal,
            }))}
            openClientId={openClientId}
          />
        ) : undefined
      }
      railFooter={
        /* Only the reason you cannot make one. Creating is on the bar now,
           beside the account, where it takes no scrolling to reach. */
        showClients && atLimit ? (
          <p className="ws-rail-copy px-1 text-[12px] leading-snug" style={{ color: "var(--text-tertiary)" }}>
            Archive one first. You&apos;re at your {overview.planLabel} limit of {overview.limit}{" "}
            active.
          </p>
        ) : undefined
      }
    >
          <div className="ws-overview-body">
            <OverviewLanding
              showClients={showClients}
              aside={
                <WatchDemo
                  compact
                  canCreate={showClients && !atLimit}
                  createHref="/whitbyos/workspaces?new=1"
                />
              }
            />

            <p className="ws-section-label">The picture today</p>
            <div className="mb-4 grid w-full gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
            {showClients ? (
              <>
            <Stat
              value={overview.active}
              label="Active workspaces"
              glyph="⌂"
              tone="blue"
              note={
                overview.limit === null
                  ? "Limits agreed per contract"
                  : `of ${overview.limit} on ${overview.planLabel}`
              }
              fill={
                overview.limit
                  ? { value: overview.active, of: overview.limit }
                  : undefined
              }
            />
            <Stat
              value={overview.totalClients}
              label="Clients"
              glyph="◎"
              tone="amber"
              note="in this organization"
              href={everywhere("/whitbyos/clients")}
            />
            <Stat
              value={overview.portalsEnabled}
              label="Client portals"
              glyph="◇"
              tone="green"
              note={`of ${overview.totalClients} client${overview.totalClients === 1 ? "" : "s"}`}
              href={everywhere("/whitbyos/contacts")}
              fill={
                overview.totalClients
                  ? { value: overview.portalsEnabled, of: overview.totalClients }
                  : undefined
              }
            />
              </>
            ) : null}
            <Stat
              value={overview.activeRequests}
              label="Active requests"
              glyph="▣"
              tone={attention.length > 0 ? "rose" : "blue"}
              note={overview.activeRequests === 0 ? "none open now" : "open now"}
              href={everywhere("/whitbyos/requests")}
              spark={board.trend.map((month) => month.opened)}
            />
            </div>

            <OverviewDashboard
              year={new Date().getFullYear()}
              trend={board.trend}
              slices={workSlices}
              top={topClients}
              progress={[
                { label: "Today", value: board.tasks.dueToday },
                { label: "This week", value: board.tasks.dueThisWeek },
                { label: "This month", value: board.tasks.dueThisMonth },
                { label: "Closed", value: widgets.insights.completedThisMonth },
              ]}
              recent={recent}
              recentHref="/whitbyos/calendar"
            />

      <div className="grid w-full gap-3 lg:grid-cols-2">
        {/*
         * What is late, and how the firm is doing.
         *
         * "Tasks" used to sit beside this and listed the same five overdue
         * tasks: `attention` is the late Requests *and* the late tasks, so the
         * two panels were one list printed twice, at twice the height. The
         * summary belongs here instead — what is wrong, and how things stand,
         * read together.
         */}
        <Panel
          glyph="!"
          title="Needs attention"
          count={attention.length}
          tone={attention.length > 0 ? "danger" : "quiet"}
          href="/whitbyos/waiting"
          more="See everything waiting"
        >
          {attention.length === 0 ? (
            <Empty glyph="✓" line="Nothing is late and nothing is waiting on you." />
          ) : (
            attention.slice(0, 5).map((row) => (
              <Line
                key={row.id}
                href={row.href}
                clientId={row.clientId}
                title={row.title}
                note={row.note}
                trailing={row.flag}
                tone="danger"
              />
            ))
          )}
        </Panel>

        <Panel glyph="▧" title="Filed and sent">
          <Tally
            glyph="❐"
            label="Documents"
            value={board.documents.total}
            note={
              board.documents.needsAttention > 0
                ? `${board.documents.needsAttention} need doing`
                : "All current"
            }
            alert={board.documents.needsAttention > 0}
            href="/whitbyos/documents"
          />
          <Tally
            glyph="▧"
            label="Form answers"
            value={board.forms.total}
            note={
              board.forms.needsReview > 0
                ? `${board.forms.needsReview} back and unread`
                : `${board.forms.awaiting} still with clients`
            }
            alert={board.forms.needsReview > 0}
            href="/whitbyos/forms?tab=submissions"
          />
          <Tally
            glyph="◈"
            label="Considerations"
            value={board.insights.open}
            note={
              board.insights.risk > 0
                ? `${board.insights.risk} marked a risk`
                : `${board.insights.stale} going stale`
            }
            alert={board.insights.risk > 0}
            href="/whitbyos/insights"
          />
        </Panel>
      </div>

      <div className="mt-5">
        <Link
          href={`${HERE}/archived`}
          className="text-[13px] no-underline"
          style={{ color: "var(--accent)" }}
        >
          View archived workspaces ({overview.archived.length}) →
        </Link>
      </div>

      {/* 0.9b — what archiving actually does, said before it happens. */}
      {target ? (
        <Modal
          title={`Archive ${target.name}?`}
          closeHref={HERE}
          width={460}
          pad="p-7"
          titleSize={18}
          headerGap={14}
          noClose
        >
          <div className="flex flex-col gap-4">
            <p className="text-[13px] leading-[1.6]" style={{ color: "var(--text-muted)" }}>
              This frees up an active workspace slot on your plan. All requests,
              documents and history stay intact and are restored exactly as they
              were if you unarchive it later.
            </p>

            <div className="flex justify-end gap-2.5">
              <Button unsized href={HERE} variant="secondary" className="px-4 py-[9px] text-[13.5px]">
                Cancel
              </Button>
              <form action={archiveClient}>
                <input type="hidden" name="client_id" value={target.id} />
                <SubmitPlain
                 
                  className="rounded-control px-[18px] py-[9px] text-[13.5px] font-medium text-white"
                  style={{ background: "var(--accent)" }}
                >
                  Archive Workspace
                </SubmitPlain>
              </form>
            </div>
          </div>
        </Modal>
      ) : null}
          </div>

      {adding ? (
        <AddClientDialog
          closeHref="/whitbyos/workspaces"
          returnTo="/whitbyos/workspaces"
          error={error}
          classifications={settings?.classifications ?? []}
        />
      ) : null}
    </OverviewShell>
  );
}
