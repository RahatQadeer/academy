import { Fragment } from "react";
import Link from "next/link";
import { cn } from "@/base/lib/cn";
import { getOrganizationProfile } from "@/whitbyos/lib/organization";
import { initialsOf } from "@/whitbyos/lib/client-face";
import { usesClientWorkspaces } from "@/whitbyos/lib/client-workspace";
import { PageHelp } from "@/whitbyos/settings/components/PageHelp";

export type SettingsTab =
  | "profile"
  | "workspace"
  | "workspace-defaults"
  | "organization"
  | "public-information"
  | "team"
  | "notifications"
  | "billing"
  | "invoices"
  | "security"
  | "archive";

/**
 * Screen 17's two columns — a 200px rail of tabs, and the panel beside it
 * capped at 560px so the fields never stretch across the whole window.
 *
 * Organization keeps the bare path. The firm leads the rail.
 */
const TABS: {
  slug: SettingsTab;
  label: string;
  href: string;
  group: "Organization" | "Workspace";
  cluster: string;
}[] = [
  {
    slug: "workspace",
    label: "Organization",
    href: "/whitbyos/settings",
    group: "Organization",
    cluster: "The firm",
  },
  {
    slug: "organization",
    label: "Professional information",
    href: "/whitbyos/settings/organization",
    group: "Organization",
    cluster: "The firm",
  },
  {
    slug: "public-information",
    label: "Public & contract",
    href: "/whitbyos/settings/public-information",
    group: "Organization",
    cluster: "The firm",
  },
  {
    slug: "security",
    label: "Sign-in",
    href: "/whitbyos/settings/security",
    group: "Organization",
    cluster: "Account",
  },
  {
    slug: "profile",
    label: "Profile",
    href: "/whitbyos/settings/profile",
    group: "Organization",
    cluster: "Account",
  },
  {
    slug: "team",
    label: "Team & Access",
    href: "/whitbyos/settings/team",
    group: "Organization",
    cluster: "People & billing",
  },
  {
    slug: "billing",
    label: "Billing & Plan",
    href: "/whitbyos/settings/billing",
    group: "Organization",
    cluster: "People & billing",
  },
  {
    slug: "workspace-defaults",
    label: "General",
    href: "/whitbyos/settings/workspace",
    group: "Workspace",
    cluster: "Workspace",
  },
  {
    slug: "notifications",
    label: "Notifications",
    href: "/whitbyos/settings/notifications",
    group: "Workspace",
    cluster: "Workspace",
  },
  {
    slug: "invoices",
    label: "Client invoices",
    href: "/whitbyos/settings/invoices",
    group: "Workspace",
    cluster: "Records",
  },
  {
    slug: "archive",
    label: "Archive",
    href: "/whitbyos/settings/archive",
    group: "Workspace",
    cluster: "Records",
  },
];

const PAGE_COPY: Record<SettingsTab, { intro: string; help: string }> = {
  security: {
    intro: "How you sign in, how long this device stays open unused, and which sessions you can end.",
    help: "Session Timeout signs you out of this device after a stretch of no typing or clicking. A laptop left on a desk does not stay signed in. Work you already saved is kept. One session at a time is a separate choice: signing in somewhere new signs the others out. Two-factor adds a code from your authenticator after your password.",
  },
  profile: {
    intro: "Your name, photograph and password. These belong to you, not to the firm.",
    help: "A new photograph or name is yours across every workspace. Organization name and logo live under Organization. Deleting your account is on this page too and cannot be undone from here.",
  },
  workspace: {
    intro: "The firm's name, mark and web address. This is what Whitby calls you everywhere else.",
    help: "The organization URL is the address people use to find you. The logo appears in the rail, on letters and in the portal. Time zone and currency live under General.",
  },
  organization: {
    intro: "Legal and practice details used on letters, invoices and a client's own records.",
    help: "Registered name and identifiers belong to the firm. An internal rate is for your own costing, not what a client is billed. Fields you leave blank stay blank on documents too.",
  },
  "public-information": {
    intro: "What you can quote to a prospective client, and the terms an engagement starts from.",
    help: "Nothing here is published by itself. It is the copy you pull from when you write an engagement or a public profile. Change it here and the next letter picks it up.",
  },
  team: {
    intro: "Who is in the firm, and what each person can do.",
    help: "Owners and Admins can invite. A role is what they can change, not which clients they see. An invite expires if it is not accepted.",
  },
  billing: {
    intro: "The Whitby subscription, seats and credits for this organization.",
    help: "This is what you pay Right Tail. Invoices you raise against clients are under Client invoices. Changing plan takes effect on the next billing date unless the card says otherwise.",
  },
  "workspace-defaults": {
    intro: "How this workspace counts time and money, and whether it uses Workspaces.",
    help: "Workspace Yes gives each client their own workspace. No hides client nav and keeps one organization workspace. Portal access follows your plan after that.",
  },
  notifications: {
    intro: "What you are told about, and how. Saved against your account.",
    help: "In-app switches apply immediately. Email alerts wait until an email account is connected under Integrations.",
  },
  invoices: {
    intro: "Invoices you raise against clients. Drafts stay invisible until you send them.",
    help: "Your Whitby subscription is under Billing & Plan. Sending an invoice is what makes it visible in the portal. A draft can be edited or discarded.",
  },
  archive: {
    intro: "Anything archived in this workspace, in one list, so you can restore it or let it go.",
    help: "Archived items do not count against plan limits. Restore puts the item back where it was. Permanent delete is final and may need an Owner.",
  },
};

/**
 * Two areas, reached from two places and drawn two ways.
 *
 * The firm's settings are opened from the cog on Workspace Overview and are
 * the firm's whether or not a client workspace is open — so they cover the
 * window, rail and bar included. The workspace's own are opened from Settings
 * on that rail and belong inside it, where everything else about the
 * workspace is, so they are an ordinary screen with the rail still there.
 *
 * One shell for both: the tab you are on says which area you are in, and the
 * rail lists that area only.
 */
type Area = "Organization" | "Workspace";

/**
 * Settings belong to the firm, so they are not drawn inside a client.
 *
 * These screens used to render in the ordinary product shell — the rail on
 * the left, the bar on top, and the bar saying CLIENT · Rohail Khan over a
 * page about the whole organization's billing. It read as that client's
 * settings, which is exactly what they are not: the firm has one profile, one
 * team, one plan, and they do not change because you happened to have a
 * client workspace open when you opened them.
 *
 * So the same device Workspace Overview uses: a cover laid over the shell by
 * the page rather than a layout that hides it. It leaves when the page does —
 * a layout would not, and going anywhere afterwards would land on a screen
 * with no rail at all.
 *
 * Client-level settings are a separate thing and live inside the client.
 */
export async function SettingsShell({
  active,
  title,
  intro,
  help,
  action,
  width = 560,
  children,
}: {
  active: SettingsTab;
  title: string;
  intro?: string;
  help?: string;
  /** 17.2 puts a button beside its heading; the others do not. */
  action?: React.ReactNode;
  /** The export varies this per tab: 560, 600, 680 — and none at all on 17.2,
      whose table is given the full width. */
  width?: number | null;
  children: React.ReactNode;
}) {
  const copy = PAGE_COPY[active];
  const blurb = intro ?? copy.intro;
  const tip = help ?? copy.help;
  const organization = await getOrganizationProfile();
  const orgName = organization?.name ?? "Your organization";
  const showClientTabs = await usesClientWorkspaces();

  const area: Area = TABS.find((tab) => tab.slug === active)?.group ?? "Organization";
  const tabs = TABS.filter(
    (tab) =>
      tab.group === area && (showClientTabs || tab.slug !== "invoices"),
  );

  const rail = (
    <div
      className="h-fit w-full shrink-0 rounded-[14px] border p-2 lg:w-[208px]"
      style={{
        background: "var(--surface)",
        borderColor: "var(--chrome-line)",
        boxShadow: "0 1px 2px rgba(31,72,125,.05), 0 12px 32px -24px rgba(31,72,125,.35)",
      }}
    >
      <div className="flex flex-col">
        {tabs.map((tab, index) => {
          const current = tab.slug === active;
          const showCluster = index === 0 || tab.cluster !== tabs[index - 1]?.cluster;
          return (
            <Fragment key={tab.slug}>
              {showCluster ? (
                <div
                  className={cn(
                    "px-2.5 pb-1.5 text-[11px] font-semibold uppercase tracking-[0.07em]",
                    index === 0 ? "pt-1" : "mt-2.5 border-t pt-3",
                  )}
                  style={{ color: "var(--text-quiet)", borderColor: "var(--chrome-line)" }}
                >
                  {tab.cluster}
                </div>
              ) : null}
              <Link
                href={tab.href}
                prefetch
                aria-current={current ? "page" : undefined}
                className={cn(
                  "relative mb-0.5 rounded-[9px] py-[9px] pl-4 pr-2.5 text-[13.5px] leading-[1.35] no-underline transition-colors",
                  current ? "font-semibold" : "hover:bg-[var(--surface-soft)]",
                )}
                style={{
                  background: current ? "var(--accent-tint)" : undefined,
                  color: current ? "var(--accent)" : "var(--ink)",
                }}
              >
                {current ? (
                  <span
                    aria-hidden
                    className="absolute bottom-[9px] left-[7px] top-[9px] w-[3px] rounded-full"
                    style={{ background: "var(--accent)" }}
                  />
                ) : null}
                {tab.label}
              </Link>
            </Fragment>
          );
        })}
      </div>
    </div>
  );

  const panel = (
    <div
      className="min-w-0 flex-1 rounded-[14px] border bg-surface px-8 py-7"
      style={{
        borderColor: "var(--chrome-line)",
        boxShadow: "0 1px 2px rgba(31,72,125,.05), 0 12px 32px -22px rgba(31,72,125,.4)",
        maxWidth: width ? width + 64 : undefined,
      }}
    >
      <div className="mb-6">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-2">
            <h1 className="text-[22px] font-bold tracking-[-0.3px]">{title}</h1>
            <div className="mt-0.5">
              <PageHelp text={tip} />
            </div>
          </div>
          {action}
        </div>
        <p
          className="mt-2 max-w-[42rem] text-[13.5px] leading-[1.55]"
          style={{ color: "var(--text-secondary)" }}
        >
          {blurb}
        </p>
      </div>
      {children}
    </div>
  );

  /*
   * The workspace's own settings stay inside the product.
   *
   * They are about how this workspace keeps its work, so the rail that every
   * other screen about the workspace hangs off should still be there — and
   * Settings on that rail is what opens them.
   */
  if (area === "Workspace") {
    return (
      <div className="mx-auto flex max-w-[1060px] flex-col gap-5 px-4 py-6 sm:px-8 sm:py-8 lg:flex-row lg:gap-9">
        {rail}
        {panel}
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto"
      style={{
        background:
          "radial-gradient(1100px 520px at 18% -8%, #ffffff 0%, rgba(255,255,255,0) 62%), linear-gradient(180deg, #f3f5f9 0%, #eef1f6 100%)",
      }}
    >
      {/* Whose settings these are, and the way out. Sticky, because the tabs
          below it are long enough to scroll and "done" should not scroll away
          with them. */}
      <div
        className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b px-8 py-3"
        style={{ background: "var(--surface)", borderColor: "var(--chrome-line)" }}
      >
        <div className="flex min-w-0 items-center gap-2.5">
          <span
            aria-hidden
            className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-[9px] text-[11.5px] font-bold"
            style={{
              background: organization?.logoUrl ? "#ffffff" : "var(--accent-tint)",
              color: "var(--accent)",
              boxShadow: "0 0 0 1px var(--chrome-line)",
            }}
          >
            {organization?.logoUrl ? (
              // Signed URL on a private bucket, so the optimiser cannot fetch it.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={organization.logoUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              initialsOf(orgName)
            )}
          </span>
          <span className="truncate text-[14px] font-semibold">{orgName}</span>
          <span className="text-[13.5px]" style={{ color: "var(--text-tertiary)" }}>
            · Organization
          </span>
        </div>

        <Link
          href="/whitbyos/workspaces"
          prefetch
          className="shrink-0 rounded-control border px-3.5 py-[7px] text-[13px] font-medium no-underline transition-colors hover:bg-[var(--surface-soft)]"
          style={{ borderColor: "var(--chrome-line)", color: "var(--ink)" }}
        >
          Done
        </Link>
      </div>

      <div className="mx-auto flex max-w-[1060px] flex-col gap-5 px-4 py-6 sm:px-8 sm:py-8 lg:flex-row lg:gap-9">
        {rail}
        {panel}
      </div>
    </div>
  );
}
