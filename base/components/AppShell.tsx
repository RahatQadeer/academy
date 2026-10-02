import { Sidebar, type NavItem } from "@/base/components/Sidebar";
import type { Entitlement, ProductKey } from "@/base/types";
import type { ReactNode } from "react";

export type { NavItem };

export function AppShell({
  productKey,
  workspaceName,
  workspaceNote,
  workspaceLogo,
  items,
  userName,
  userEmail,
  userPhoto,
  userRole,
  entitlements,
  previewAll,
  badge,
  collapsible,
  signOut,
  headerSlot,
  roleTag,
  roleTagStyle,
  roleLabel,
  workspaceHref,
  accountHref,
  account,
  mobileDrawer,
  portalAccess,
  portalUpgradeHref,
  noSwitch,
  brand = true,
  narrow,
  clientChip,
  children,
}: {
  productKey: ProductKey;
  workspaceName?: string;
  /** The line under it — see ProductSwitcher. */
  workspaceNote?: string;
  items: NavItem[];
  userName: string;
  userEmail?: string;
  userPhoto?: string | null;
  userRole?: string;
  entitlements?: Entitlement[];
  previewAll?: boolean;
  workspaceLogo?: string | null;
  badge?: string;
  collapsible?: boolean;
  /** False where the product's own bar carries Sign out instead. */
  signOut?: boolean;
  headerSlot?: ReactNode;
  roleTag?: string;
  roleTagStyle?: { background: string; color: string };
  roleLabel?: string;
  /** Opens the workspace overview from the sidebar name, not only after login. */
  workspaceHref?: string;
  /** Sidebar photo / name opens profile settings so they can view and change it. */
  accountHref?: string;
  /** See `Sidebar`'s own note — false where the product's bar says who you are. */
  account?: boolean;
  /** See `Sidebar`'s own note. */
  mobileDrawer?: boolean;
  portalAccess?: "open" | "hidden" | "upgrade";
  portalUpgradeHref?: string;
  /** See ProductSwitcher. */
  noSwitch?: boolean;
  /** See `Sidebar`'s own note — a rail measured to its own labels. */
  narrow?: boolean;
  children: React.ReactNode;
  /** False when the product's top bar already carries the organization. */
  brand?: boolean;
  /**
   * Whose client work is open — drawn at the head of Whitby's rail the way
   * the organization mark sits on the top bar.
   */
  clientChip?: { name: string; photo?: string | null } | null;
}) {
  return (
    /*
     * The product, named on the frame every one of its screens is drawn inside.
     *
     * One attribute is enough to repaint a whole product, because nothing here
     * paints a colour directly: the stylesheet redefines the tokens under
     * `[data-product="..."]` and everything follows, inline `style` attributes
     * included, which no component-level rule could reach.
     *
     * Nothing claims a block today. The palette in `globals.css` is Whitby's,
     * and the Client Portal wears it deliberately rather than by default — see
     * the note there. The hook stays because it is what a product would use to
     * take a colour of its own, and it costs an attribute.
     */
    <div data-product={productKey} className="pa-app-shell flex flex-col overflow-hidden bg-canvas">
      {headerSlot}
      <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden">
      <Sidebar
        productKey={productKey}
        workspaceName={workspaceName}
        workspaceNote={workspaceNote}
        workspaceLogo={workspaceLogo}
        items={items}
        userName={userName}
        userEmail={userEmail}
        userPhoto={userPhoto}
        userRole={userRole}
        entitlements={entitlements}
        previewAll={previewAll}
        badge={badge}
        collapsible={collapsible}
        signOut={signOut}
        roleTag={roleTag}
        roleTagStyle={roleTagStyle}
        roleLabel={roleLabel}
        workspaceHref={workspaceHref}
        accountHref={accountHref}
        account={account}
        mobileDrawer={mobileDrawer}
        portalAccess={portalAccess}
        portalUpgradeHref={portalUpgradeHref}
        noSwitch={noSwitch}
        brand={brand}
        narrow={narrow}
        clientChip={clientChip}
      />
      {/* Every in-app frame in the reference is drawn on white; #f1f1ef is
          the ground for the signed-out screens, not for a product shell. */}
      <main className="pa-app-shell-main flex min-h-0 min-w-0 max-w-full flex-1 flex-col overflow-x-clip overflow-y-auto bg-surface">
        <div className="min-h-0 min-w-0 max-w-full flex-1">{children}</div>
      </main>
      </div>
    </div>
  );
}
