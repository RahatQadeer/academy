import { headers } from "next/headers";
import { after } from "next/server";
import Link from "next/link";
import { NotificationBell } from "@/whitbyos/components/NotificationBell";
import { HeaderSearch } from "@/whitbyos/components/HeaderSearch";
import { HeaderControls } from "@/whitbyos/components/home/HomeHeader";
import { Logo, Wordmark } from "@/base/components/Logo";
import { Avatar } from "@/base/components/Avatar";
import { ROLE_LABELS } from "@/whitbyos/lib/settings-vocab";
import { listNotices, unreadIn } from "@/whitbyos/lib/notifications";
import { listMyWorkspaces } from "@/whitbyos/lib/dashboard";
import { getCurrentWorkspaceId } from "@/whitbyos/lib/workspace";
import { isWorkspaceReadOnly } from "@/whitbyos/lib/read-only";
import { getOpenClient } from "@/whitbyos/lib/open-client";
import { syncGmailIfStale } from "@/whitbyos/lib/gmail-sync";
import { quickAddFor } from "@/whitbyos/quick-add";
import { usesClientWorkspaces } from "@/whitbyos/lib/client-workspace";
import { getSessionProfile } from "@/base/identity/session";
import { isSupabaseConfigured } from "@/base/lib/supabase/server";
import { WhitbyDock } from "@/whitbyos/components/WhitbyDock";

/**
 * Whitby's top bar.
 *
 * RightTail Professional sits on the left. The open client sits at the head
 * of the rail instead — same kind of chip, beside the menu rather than
 * repeating on this bar. Search, Ask Whitby, quick add, the bell and the
 * professional's face stay on the right.
 *
 * `x-pa-pathname` is set by the middleware on every request, so the panel
 * knows which page it was opened on and can send an answer back to it.
 */
export async function WhitbyHeader() {
  const configured = isSupabaseConfigured();
  const [notices, workspaces, workspaceId, head, openClient, readOnly, showClients, profile] =
    await Promise.all([
      listNotices(),
      listMyWorkspaces(),
      getCurrentWorkspaceId(),
      headers(),
      getOpenClient(),
      isWorkspaceReadOnly(),
      usesClientWorkspaces(),
      configured ? getSessionProfile() : Promise.resolve(null),
    ]);

  /* The workspace's own name, plan, mark and portal state all belonged to
     the mast that used to stand here. They are read by `ProductShell` for
     the rail's switcher now, and reading them twice would be two queries for
     one answer. */

  const here = head.get("x-pa-pathname") || "/whitbyos";

  const userName = profile?.user.preferred_name || profile?.user.full_name || "You";
  const userPhoto = profile?.user.avatar_url;
  const userRole =
    workspaceId && profile?.user.id
      ? await memberRole(workspaceId, profile.user.id)
      : undefined;

  if (workspaceId) after(() => syncGmailIfStale(workspaceId));

  return (
    <div
      data-pa-topbar
      className="pa-whitby-topbar pa-print-hide sticky top-0 z-20 flex shrink-0 items-center justify-between gap-4 px-3 py-2.5 sm:px-5 lg:px-6"
    >
      {/* Room for the drawer button, which is `fixed` at the top left below
          md and otherwise lands on the workspace logo. The portal header
          has had this line since it was written. */}
      {/*
        * Private Attaché, top left of the page.
        *
        * This is where the web puts an application's own logo, and for a
        * while it held the customer's firm instead while the house mark sat
        * at the head of the rail, where the web puts the workspace. Each was
        * in the other's place, which is why the screen read oddly whichever
        * of them was restyled. The workspace switcher is in the rail now,
        * which is also where the client's own note asks for it.
        */}
      <div className="flex min-w-0 items-center gap-1 pl-[42px] md:pl-0">
        <Link
          href="/whitbyos"
          aria-label="Private Attaché"
          className="flex min-w-0 items-center gap-2.5 rounded-[10px] px-1.5 py-1 no-underline transition-colors hover:bg-[var(--surface-soft)]"
        >
          <span
            className="flex shrink-0 items-center justify-center rounded-[10px]"
            style={{
              boxShadow: "0 0 0 1px color-mix(in srgb, var(--chrome-line) 80%, #b9c3cd)",
            }}
          >
            {/* The house mark is the one thing on this bar that is always
                the same, so it can afford to be the largest. */}
            <Logo size={34} className="rounded-[10px]" />
          </span>
          {/* The name only where there is room for it. Below the small
              breakpoint the drawer button and the header's own actions have
              the width, and half a wordmark is worse than none. */}
          <span className="hidden min-w-0 flex-col gap-[4px] leading-none sm:flex">
            <Wordmark size={16.5} />
            <span
              className="truncate text-[10.5px] font-semibold uppercase tracking-[0.16em]"
              style={{ color: "var(--accent)" }}
            >
              Whitby
            </span>
          </span>
        </Link>

      </div>

      <div className="flex min-w-0 shrink items-center gap-2.5" data-tour="header-actions">
        {/*
          * Whose client work is open, at the end of the bar with the tools.
          *
          * It has been in three places today: under the workspace in the
          * rail, where it read as the person signed in; beside the house
          * mark, where it read as part of the product's own name. Here it
          * sits with the things you act with, which is what it is: the one
          * client everything on this screen is currently about.
          */}
        {showClients && openClient ? (
          <>
            <span
              aria-hidden
              className="hidden shrink-0 text-[13px] sm:inline"
              style={{ color: "var(--text-disabled)" }}
            >
              ›
            </span>
            <Link
              href={`/whitbyos/clients/${openClient.id}`}
              title={`Open ${openClient.name}`}
              className="hidden min-w-0 items-center gap-1.5 rounded-control px-1.5 py-1 no-underline transition-colors hover:bg-[var(--surface-soft)] sm:flex"
            >
              <Avatar name={openClient.name} size={20} src={openClient.photo} />
              <span
                className="truncate text-[13px] font-medium"
                style={{ color: "var(--ink)" }}
              >
                {openClient.name}
              </span>
            </Link>
          </>
        ) : null}

        <HeaderSearch />

        {/* Opens over the page rather than navigating away from it — the
            panel is told which screen it is on, so a task asked for on a
            plan lands on that plan. "Full screen" inside it is still one
            press away. */}
        <WhitbyDock current={here === "/whitbyos/ask" || here.startsWith("/whitbyos/ask/")} />

        <HeaderControls
          workspaces={workspaces}
          currentWorkspaceId={workspaceId}
          quickAdd={
            readOnly
              ? []
              : quickAddFor({
                  insideClient: Boolean(openClient),
                  usesClientWorkspaces: showClients,
                }).map((item) => ({
                  href: item.href,
                  label: item.label,
                  description: item.description,
                }))
          }
          onHome={here === "/whitbyos"}
        />

        <NotificationBell notices={notices} unread={unreadIn(notices)} here={here} />

        <Link
          href="/whitbyos/settings/profile#profile-photo"
          title={[userName, userRole].filter(Boolean).join(" · ") || "Profile settings"}
          aria-label={
            userRole
              ? `${userName}, ${userRole}. Open profile settings`
              : `${userName}. Open profile settings`
          }
          className="pa-bar-owner group relative flex shrink-0 items-center justify-center rounded-full no-underline outline-none"
          style={{ color: "var(--ink)" }}
        >
          <Avatar name={userName} size={30} src={userPhoto} />
          <span
            className="pointer-events-none absolute right-0 top-[calc(100%+8px)] z-40 hidden min-w-[7.5rem] max-w-[12rem] rounded-[8px] border px-2.5 py-1.5 group-hover:block group-focus-visible:block"
            style={{
              background: "var(--surface)",
              borderColor: "var(--chrome-line)",
              boxShadow: "0 8px 24px rgba(15,15,15,.12)",
            }}
            role="tooltip"
          >
            <span className="block truncate text-[12.5px] font-medium leading-tight">{userName}</span>
            {userRole ? (
              <span
                className="mt-0.5 block truncate text-[11px] leading-tight"
                style={{ color: "var(--text-tertiary)" }}
              >
                {userRole}
              </span>
            ) : null}
          </span>
        </Link>
      </div>
    </div>
  );
}

async function memberRole(workspaceId: string, userId: string) {
  const { createClient } = await import("@/base/lib/supabase/server");
  const supabase = await createClient();

  const { data } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();

  const role = data?.role as string | undefined;
  return role ? (ROLE_LABELS[role] ?? role) : undefined;
}
