import { notFound, redirect } from "next/navigation";
import type { ReactNode } from "react";
import { ProductShell } from "@/base/components/ProductShell";
import { getProductBySlug } from "@/base/switcher/products";
import { WhitbyHeader } from "@/whitbyos/components/WhitbyHeader";
import { ReadOnlyBanner } from "@/whitbyos/components/ReadOnlyBanner";
import { CoverGround } from "@/whitbyos/components/CoverGround";
import { SessionTimeoutWatch } from "@/whitbyos/components/SessionTimeoutWatch";
import { getOpenClientId } from "@/whitbyos/lib/open-client";
import { usesClientWorkspaces } from "@/whitbyos/lib/client-workspace";
import { NAV as whitbyNav, navWith as whitbyNavWith } from "@/whitbyos/nav";
import { NAV as portalNav, navFor as portalNavFor } from "@/client-portal/nav";
import { getPortalContext } from "@/client-portal/lib/portal-context";
import { waitingAreas } from "@/client-portal/lib/data/waiting";
import { whitbyWaiting } from "@/whitbyos/lib/nav-waiting";
import { getSessionProfile } from "@/base/identity/session";
import { hasPortalInvitation } from "@/base/identity/portal-access";
import { isClientAudience, isPortalOnlyClient } from "@/base/auth/landing";
import { isSupabaseConfigured } from "@/base/lib/supabase/server";
import { NAV as academyNav } from "@/academy/nav";
import { NAV as partnerNav } from "@/partner-center/nav";

const STATIC_NAV = {
  whitbyos: whitbyNav,
  "client-portal": portalNav,
  academy: academyNav,
  "partner-center": partnerNav,
} as const;

const PRODUCT_SLUGS = Object.keys(STATIC_NAV);

export function generateStaticParams() {
  return PRODUCT_SLUGS.map((product) => ({ product }));
}

export const dynamicParams = false;

export default async function ProductLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ product: string }>;
}) {
  const { product: slug } = await params;
  const product = getProductBySlug(slug);
  if (!product || !(slug in STATIC_NAV)) notFound();

  // The Client Portal is the one product whose nav is not the same for every
  // reader: `whitbyos_client_members.permissions` grants its areas one at a
  // time, and an item the signed-in client cannot open is left out rather than
  // drawn and refused. `routes.tsx` gates the addresses themselves.

  // The Client Portal is reached by accepting a professional's invitation and
  // by no other route. The switcher draws its card closed for anybody without
  // one, but a closed card is only half a rule while the address still opens —
  // typing /client-portal let a professional straight into a sample account.
  //
  // `demo` is left alone: an unconfigured deployment and a session that has
  // not finished linking both land there on purpose, and turning those into a
  // redirect would send somebody in a loop rather than explain anything.
  if (slug === "client-portal" && isSupabaseConfigured()) {
    const profile = await getSessionProfile();
    if (!(await hasPortalInvitation(profile?.user.id))) redirect("/switcher?notice=portal-invite-only");
  }

  // An invited client who never set up Whitby must not land on the
  // organisation overview. The switcher sends them on to the portal.
  if (slug === "whitbyos" && isSupabaseConfigured()) {
    const profile = await getSessionProfile();
    if (profile) {
      const client = await isClientAudience(profile.user.id, profile.user.email);
      if (isPortalOnlyClient(client, profile.workspaces, profile.user.id)) {
        redirect("/switcher");
      }
    }
  }

  const portal = slug === "client-portal" ? await getPortalContext() : null;

  /*
   * A closed portal signs you out of it.
   *
   * `getPortalContext` already refuses to say who a reader is while the firm's
   * switch is off, which is what stops every screen and every action. This is
   * the other half of what closing means: the session that was already open
   * does not get to sit there on a dead portal until it expires.
   */
  if (portal?.demoReason === "portal_closed") {
    redirect(`/auth/sign-out?next=${encodeURIComponent("/login?notice=portal-closed")}`);
  }

  // A dot on the screens holding something for this client. Only the portal
  // has one; the other three navs are static and stay so.
  const waiting = portal ? await waitingAreas(portal.areas) : {};

  const items =
    slug === "client-portal"
      ? portalNavFor(portal!.areas, waiting)
      : slug === "whitbyos"
        ? whitbyNavWith({
            ...(await whitbyWaiting()),
            // Singular while one client's workspace is open, because that is
            // what the screen behind it now shows.
            oneClient: Boolean(await getOpenClientId()),
            usesClientWorkspaces: await usesClientWorkspaces(),
          })
        : STATIC_NAV[slug as keyof typeof STATIC_NAV];

  // Partner Center and Academy own their shells in [[...slug]]/layout so
  // auth / onboarding can stay full-bleed (no product chrome).
  if (slug === "partner-center" || slug === "academy") {
    return children;
  }

  return (
    <ProductShell
      product={product.key}
      items={items}
      // Each bar reads its own half of `whitbyos_notifications`: Whitby's the
      // rows addressed to a member, the portal's the rows addressed to the
      // contact the login is.
      //
      // The portal's own bar is not passed here. It carries the title of the
      // screen under it, and this layout's segment is the product — it does not
      // change when a client opens a Request, so a bar drawn from here would
      // still be naming the list they left. It is rendered one level down, at
      // the segment that does change; see `[[...slug]]/layout.tsx`.
      headerSlot={slug === "whitbyos" ? <WhitbyHeader /> : undefined}
      workspaceName={portal?.professionalName ?? undefined}
      /*
       * The rail closes to its icons.
       *
       * Whitby's is seventeen items deep and the screens beside it — a
       * conversation, a plan of forty tasks, a table of documents — are the
       * ones people widen the window for. The choice is remembered, so it is
       * made once rather than on every visit.
       */
      collapsible={slug === "whitbyos" || slug === "client-portal"}
      // The portal's longest nav label is "Profile & Settings", which leaves
      // 70px of nothing between it and the rule on Whitby's 224px rail. The
      // screens beside it get that width back.
      narrow={slug === "client-portal"}
    >
      {/* Above everything, so the state is met wherever the person is rather
          than only where they can fix it. */}
      {slug === "whitbyos" ? <ReadOnlyBanner /> : null}
      {/* Painted from here rather than from the page, so it survives the frame
          between one cover leaving and the next arriving. */}
      {slug === "whitbyos" ? <CoverGround /> : null}
      {slug === "whitbyos" ? <SessionTimeoutWatch /> : null}
      {children}
    </ProductShell>
  );
}
