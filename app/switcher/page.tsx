import { redirect } from "next/navigation";
import { Logo } from "@/base/components/Logo";
import { Callout } from "@/base/components/Callout";
import { EMPTY_OVERVIEW, getSwitcherOverview } from "@/base/switcher/overview";
import { GlanceBoard } from "@/base/switcher/GlanceBoard";
import { SwitcherProductCard } from "@/base/switcher/ProductCard";
import { getSessionProfile } from "@/base/identity/session";
import { productState, visibleProducts } from "@/base/identity/entitlements";
import { hasPortalInvitation } from "@/base/identity/portal-access";
import { isSupabaseConfigured } from "@/base/lib/supabase/server";
import { PRODUCTS } from "@/base/switcher/products";
import { isClientAudience, isPortalOnlyClient } from "@/base/auth/landing";
import { AlertIcon } from "@/base/components/AuthIcons";
import { getCurrentWorkspacePlan } from "@/whitbyos/lib/workspace";
import { planIncludesClientPortal } from "@/whitbyos/lib/billing-vocab";
import type { Entitlement } from "@/base/types";

const DEV_ENTITLEMENTS: Entitlement[] = PRODUCTS.map((product) => ({
  id: product.key,
  user_id: "dev",
  product: product.key,
  workspace_id: product.key === "whitbyos" ? "dev-workspace" : null,
  status: "active",
  is_default_landing: false,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
}));

/** Home says "Good morning, Jordan"; this is the same clock. */
function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export default async function SwitcherPage({
  searchParams,
}: {
  searchParams?: Promise<{ notice?: string }>;
}) {
  const notice = (await searchParams)?.notice;
  const configured = isSupabaseConfigured();
  const profile = configured ? await getSessionProfile() : null;

  if (configured && !profile) {
    redirect("/login");
  }

  // Partner Admin Accept-invite used to dump people on the switcher. If the
  // role is still invited, activate it and send them to the admin shell.
  if (configured && profile?.user) {
    try {
      const { resolvePartnerAdminPostAuthLanding } = await import(
        "@/partner-center/admin/lib/invite"
      );
      const adminLanding = await resolvePartnerAdminPostAuthLanding({
        userId: profile.user.id,
        email: profile.user.email,
        onlyInvited: true,
      });
      if (adminLanding) redirect(adminLanding);
    } catch {
      // Switcher remains available if the divert fails.
    }
  }

  const refreshed = configured ? await getSessionProfile() : profile;
  const entitlements = refreshed?.entitlements ?? (configured ? [] : DEV_ENTITLEMENTS);
  const products = visibleProducts(entitlements);

  // The Client Portal is reached by invitation and by nothing else, so its
  // card asks the fact rather than the entitlement — which every professional
  // holds for historical reasons and which says nothing about being a client.
  const invitedToPortal = configured
    ? await hasPortalInvitation(refreshed?.user.id)
    : true;
  const clientAudience = configured
    ? await isClientAudience(refreshed?.user.id, refreshed?.user.email)
    : false;
  const portalOnly = isPortalOnlyClient(
    clientAudience,
    refreshed?.workspaces ?? [],
    refreshed?.user.id,
  );

  // A client has one place to be, and this page is a list of the others.
  // Every sign-in path lands here by default, so this is where they are sent
  // on — before anything is drawn, so the products they are not part of are
  // never shown to them. Only once the invitation is accepted: until then the
  // portal's own layout would send them straight back, and this page is what
  // explains why.
  if (configured && portalOnly && invitedToPortal) {
    redirect("/client-portal");
  }

  const overview = configured ? await getSwitcherOverview() : EMPTY_OVERVIEW;
  const portalOnPlan = configured
    ? planIncludesClientPortal(await getCurrentWorkspacePlan())
    : true;

  const name = refreshed?.user.preferred_name || refreshed?.user.full_name || "";
  const firstName = name.split(/\s+/)[0] || "";

  return (
    <div className="min-h-screen" style={{ background: "var(--canvas)" }}>
      <header className="pa-switcher-nav sticky top-0 z-10">
        <div className="relative z-[1] grid w-full grid-cols-[1fr_auto] items-center gap-4 px-6 py-3.5 sm:grid-cols-[1fr_auto_1fr] sm:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <span className="pa-switcher-nav-mark">
              <Logo size={26} />
            </span>
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="truncate text-[14.5px] font-semibold tracking-tight text-white">
                Private Attaché
              </span>
              <span className="pa-switcher-nav-pill hidden sm:inline">Products</span>
            </div>
          </div>
          <div className="hidden items-center gap-1.5 sm:flex" aria-hidden>
            <span className="pa-switcher-nav-dot" style={{ background: "var(--module-whitby-fg)" }} />
            <span className="pa-switcher-nav-dot" style={{ background: "var(--module-portal-fg)" }} />
            <span className="pa-switcher-nav-dot" style={{ background: "var(--module-academy-fg)" }} />
            <span className="pa-switcher-nav-dot" style={{ background: "var(--module-partner-fg)" }} />
          </div>
          <form action="/auth/sign-out" method="post" className="justify-self-end">
            <button type="submit" className="pa-switcher-nav-out">
              Sign out
            </button>
          </form>
        </div>
        <span className="pa-switcher-nav-line" aria-hidden />
      </header>

      <div className="mx-auto max-w-[1080px] px-6 py-6 sm:px-8 sm:py-7">
        {/* The layout sends anybody without an invitation back here. A bounce
            with nothing said reads as the product losing its place. */}
        {notice === "portal-invite-only" ? (
          <div
            className="pa-rise mb-5 flex items-start gap-2.5 rounded-[10px] px-4 py-3"
            style={{ background: "var(--warning-bg)", color: "var(--warning-fg)" }}
            role="status"
          >
            <span className="mt-px shrink-0" aria-hidden>
              <AlertIcon size={15} />
            </span>
            <span className="text-[13px] leading-[1.5]">
              The Client Portal opens by invitation. A professional adds you to
              a workspace and emails you a link; until then there is
              nothing there for you to see.
            </span>
          </div>
        ) : null}

        <div className="pa-rise">
          <div
            className="text-[11px] font-semibold uppercase tracking-[0.08em]"
            style={{ color: "var(--text-tertiary)" }}
          >
            Private Attaché
          </div>
          <h1 className="mt-1.5 text-[24px] font-bold leading-[1.15] tracking-[-0.4px] text-pretty sm:text-[28px]">
            {firstName ? `${greeting()}, ${firstName}` : "Your products"}
          </h1>
          <p className="mt-1.5 max-w-[560px] text-[13.5px] leading-[1.45]" style={{ color: "var(--text-secondary)" }}>
            {portalOnly
              ? "Open Client Portal to see what has been shared with you."
              : "Whitby drafts the work. Clients see what you mark visible. Academy trains the team. Partner Center brings the next introduction."}
          </p>
          {portalOnly ? null : (
          <div className="mt-3.5 flex flex-wrap gap-1.5">
            {["Client", "Request", "Work plan", "Follow-through"].map((step, index) => (
              <span key={step} className="flex items-center gap-1.5 text-[12px]" style={{ color: "var(--text-secondary)" }}>
                {index > 0 ? (
                  <span aria-hidden style={{ color: "rgba(55,53,47,.3)" }}>
                    →
                  </span>
                ) : null}
                <span
                  className="rounded-[6px] border border-line bg-surface px-2 py-0.5 font-medium"
                  style={{ color: "var(--ink)" }}
                >
                  {step}
                </span>
              </span>
            ))}
          </div>
          )}
        </div>

        {!configured ? (
          <Callout className="mt-6" tone="warning" title="Supabase is not connected">
            The switcher is in preview mode with all four products available.
          </Callout>
        ) : null}

        <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {products.map((product, index) => {
            if (product.key === "client_portal" && !portalOnly && !invitedToPortal) {
              if (portalOnPlan) return null;
              return (
                <SwitcherProductCard
                  key={product.key}
                  product={product}
                  entitled={false}
                  upgrade
                  index={index}
                />
              );
            }

            return (
            <SwitcherProductCard
              key={product.key}
              product={product}
              entitled={
                product.key === "client_portal"
                  ? invitedToPortal
                  : portalOnly
                    ? false
                    : productState(product.key, entitlements) === "available"
              }
              lockedReason={
                product.key === "client_portal" && !invitedToPortal
                  ? "You're not invited to a workspace"
                  : portalOnly && product.key !== "client_portal"
                    ? "This product is for the professional who invited you"
                    : undefined
              }
              index={index}
            />
            );
          })}
        </div>

        {portalOnly ? null : (
        <div className="pa-rise mt-8" style={{ animationDelay: "360ms" }}>
          <div className="mb-4">
            <h2 className="text-[15px] font-semibold">At a glance</h2>
            <p className="mt-1 text-[13px]" style={{ color: "var(--text-tertiary)" }}>
              Live figures from your workspaces: clients, requests, portal access, learning, and partner status. Zeros mean nothing is on file yet.
            </p>
          </div>
          <GlanceBoard data={overview} />
        </div>
        )}
      </div>
    </div>
  );
}
