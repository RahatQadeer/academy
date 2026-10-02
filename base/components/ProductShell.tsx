import { AppShell } from "@/base/components/AppShell";
import {
  getCurrentWorkspaceId,
  getCurrentWorkspaceLogoUrl,
  getCurrentWorkspacePlan,
} from "@/whitbyos/lib/workspace";
import { planIncludesClientPortal, planLabel } from "@/whitbyos/lib/billing-vocab";
import { usesClientWorkspaces } from "@/whitbyos/lib/client-workspace";
import type { NavItem } from "@/base/components/Sidebar";
import { getSessionProfile } from "@/base/identity/session";
import { hasPortalInvitation } from "@/base/identity/portal-access";
import { isClientAudience, isPortalOnlyClient } from "@/base/auth/landing";
import { isSupabaseConfigured } from "@/base/lib/supabase/server";
import { getProduct } from "@/base/switcher/products";
import type { ProductKey } from "@/base/types";
import type { ReactNode } from "react";
import { getOpenClient } from "@/whitbyos/lib/open-client";

export async function ProductShell({
  product,
  items,
  badge,
  collapsible,
  headerSlot,
  roleLabel,
  workspaceName: workspaceNameOverride,
  userPhoto: userPhotoOverride,
  accountHref,
  narrow,
  children,
}: {
  product: ProductKey;
  items: NavItem[];
  badge?: string;
  collapsible?: boolean;
  headerSlot?: ReactNode;
  roleLabel?: string;
  /** When set, the rail shows this name instead of the session's first workspace. */
  workspaceName?: string;
  /**
   * The face in the rail's footer, for a product whose people are not rows of
   * `public.users`.
   *
   * A Client Portal login is an auth user with a `contacts` row and no
   * `users.avatar_url` to read, so the default below resolves to null for every
   * client and the rail drew initials at somebody who had uploaded a photo on
   * their own Profile screen five minutes earlier. The portal signs its own and
   * passes it here.
   */
  userPhoto?: string | null;
  /** Where the footer photo goes. Each product keeps its own profile screen. */
  accountHref?: string;
  /** See `Sidebar`'s own note — a rail measured to its own labels. */
  narrow?: boolean;
  children: React.ReactNode;
}) {
  const configured = isSupabaseConfigured();

  /*
   * What this workspace is on, for the head of its own rail.
   *
   * Whitby only: it is the product with a plan, and the one whose rail had a
   * mark, a word and three inches of nothing under them.
   */
  const planValue =
    product === "whitbyos" && configured ? await getCurrentWorkspacePlan() : undefined;
  const plan = planValue ? planLabel(planValue) : undefined;
  const profile = configured ? await getSessionProfile() : null;
  const meta = getProduct(product);
  const workspaceId = configured ? await getCurrentWorkspaceId() : profile?.workspaces[0]?.id;
  const openWorkspace =
    (profile?.workspaces ?? []).find((workspace) => workspace.id === workspaceId) ??
    profile?.workspaces[0];
  const triggerName = workspaceNameOverride || openWorkspace?.name || meta.name;

  const invited = configured ? await hasPortalInvitation(profile?.user.id) : false;
  const showClientPortal =
    product === "whitbyos" && configured ? await usesClientWorkspaces() : true;
  const portalAccess = !configured
    ? "open"
    : invited
      ? "open"
      : product === "whitbyos" && showClientPortal
        ? planIncludesClientPortal(planValue ?? null)
          ? "hidden"
          : "upgrade"
        : "hidden";

  /**
   * The mark the workspace that is open was given — signed, so a private
   * bucket path becomes something the browser can draw.
   */
  const workspaceLogo = configured ? await getCurrentWorkspaceLogoUrl() : null;
  const role =
    workspaceId && profile
      ? await memberRole(workspaceId, profile.user.id)
      : undefined;

  /*
   * A client with no product of their own sees whose workspace this is and
   * nothing to switch to — the other products are not theirs, and the
   * switcher is a page they are never sent to.
   */
  const portalOnly =
    product === "client_portal" && configured && profile
      ? isPortalOnlyClient(
          await isClientAudience(profile.user.id, profile.user.email),
          profile.workspaces,
          profile.user.id,
        )
      : false;

  const openClient =
    product === "whitbyos" && configured && showClientPortal
      ? await getOpenClient()
      : null;

  return (
    <AppShell
      productKey={product}
      workspaceName={roleLabel ? undefined : triggerName}
      workspaceNote={plan ? `${plan} plan` : undefined}
      workspaceLogo={workspaceLogo}
      items={items}
      userName={profile?.user.preferred_name || profile?.user.full_name || "You"}
      userEmail={profile?.user.email}
      userPhoto={userPhotoOverride ?? profile?.user.avatar_url}
      userRole={role}
      entitlements={profile?.entitlements}
      previewAll={!configured}
      badge={badge}
      collapsible={collapsible}
      // Sign out stays on the rail; who you are is on Whitby's top bar.
      signOut={product !== "client_portal"}
      /*
       * The portal's rail does not say who you are.
       *
       * Its own bar carries the face and the name on every screen, and
       * "Profile & Settings" is an item in the nav directly above — so the
       * footer was the same photograph a third time and a third door to one
       * screen. Whitby's bar now carries the person too, so the rail keeps
       * Sign out alone.
       */
      account={product !== "whitbyos" && product !== "client_portal"}
      headerSlot={headerSlot}
      roleLabel={roleLabel}
      narrow={narrow}
      workspaceHref={product === "whitbyos" ? "/whitbyos/workspaces" : undefined}
      // Whitby: organization on the top bar; open client at the head of the rail.
      /*
       * The workspace at the head of the rail, in every product.
       *
       * Whitby used to be the exception: its workspace mast sat on the top
       * bar, where the web puts an application's own logo, and the house
       * mark sat at the head of the rail, where the web puts the workspace.
       * Both were in the other's place, which is why the screen read oddly
       * however either one was styled. Private Attaché is top left of the
       * page now and the workspace switcher is where the client's own note
       * asks for it: first thing in the rail.
       */
      brand
      /*
       * The open client is on the top bar, beside the house mark.
       *
       * Under the workspace it made two stacked blocks before the first nav
       * row, and the head of the rail carried more weight than the menu it
       * was introducing. One of the two had to move, and the workspace is
       * the one the client's note asks to find there.
       */
      clientChip={null}
      mobileDrawer
      portalAccess={portalAccess}
      portalUpgradeHref="/whitbyos/settings/billing"
      noSwitch={portalOnly}
      accountHref={
        accountHref ??
        (product === "whitbyos" ? "/whitbyos/settings/profile#profile-photo" : undefined)
      }
    >
      {children}
    </AppShell>
  );
}

const ROLE_LABELS: Record<string, string> = {
  owner: "Owner",
  admin: "Admin",
  team_lead: "Team Lead",
  coordinator: "Coordinator",
  billing: "Billing",
  marketing: "Marketing",
  viewer: "Viewer",
};

/** What this person is in the workspace whose name is above them. */
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
