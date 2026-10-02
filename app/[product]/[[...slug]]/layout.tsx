import { Suspense, type ReactNode } from "react";
import {
  PortalHeader,
  PortalHeaderFallback,
} from "@/client-portal/components/PortalHeader";
import { PartnerCenterLayout } from "@/partner-center/components/PartnerCenterLayout";
import {
  isPartnerFullScreenPath,
  partnerPathFromSlug,
} from "@/partner-center/lib/auth-routes";
import { AcademyAppShell } from "@/academy/components/AcademyAppShell";
import { academyRoleCssVars } from "@/academy/lib/roleTheme";

export const dynamic = "force-dynamic";

export default async function ProductSlugLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ product: string; slug?: string[] }>;
}) {
  const { product: slug, slug: segments } = await params;

  if (slug === "partner-center") {
    const pathname = partnerPathFromSlug(segments);
    if (isPartnerFullScreenPath(pathname)) return children;
    return <PartnerCenterLayout>{children}</PartnerCenterLayout>;
  }

  /*
   * The portal's top bar, drawn here rather than in the product's layout.
   *
   * It names the screen it is over, and this is the segment that changes when
   * one screen is left for another — the layout above keeps its params across
   * the whole product, so a bar rendered from there re-renders on a full load
   * and never again. Here it is rebuilt on every navigation, which is also what
   * keeps the bell's count and the drawer's dot honest.
   *
   * The column around the two is what `headerSlot` gave it for free while it
   * was a child of the shell's `main`: a bar that does not shrink, and a
   * region under it holding exactly the rest of the frame — which Messages
   * measures its own height against, and which a tall screen grows past so the
   * bar stays stuck to the top of the scroll rather than to the first screenful
   * of it. `flex-auto` and not `flex-1`, because an item flexed from a zero
   * basis contributes nothing to the height of a column that has none.
   */
  if (slug === "client-portal") {
    return (
      <div className="flex min-h-full flex-col">
        {/* Suspended, so this layout hands back the frame without waiting on
            the bell or on the name of the screen — otherwise the bar's reads
            would sit in front of the screen's own loading state, which is
            below it and cannot be shown until this has been. */}
        <Suspense fallback={<PortalHeaderFallback />}>
          <PortalHeader slug={segments ?? []} />
        </Suspense>
        <div className="min-h-0 flex-auto">{children}</div>
      </div>
    );
  }

  if (slug === "academy") {
    // Open Academy referral when a referred user enters Academy. Do not block the page.
    try {
      const { ensureAcademyReferralOnEntry } = await import(
        "@/partner-center/lib/referral-capture/ensure-academy-on-entry"
      );
      await ensureAcademyReferralOnEntry();
    } catch {
      // Attribution must never block Academy.
    }

    const parts = segments ?? [];
    // Segment-based: never rely on pathname headers for onboarding full-bleed.
    if (parts[0] === "onboarding") {
      return (
        <div
          className="min-h-[100dvh] bg-canvas"
          data-academy-role="learner"
          data-academy-surface="onboarding"
          style={academyRoleCssVars("learner")}
        >
          {children}
        </div>
      );
    }

    const pathname = parts.length > 0 ? `/academy/${parts.join("/")}` : "/academy";
    return <AcademyAppShell pathname={pathname}>{children}</AcademyAppShell>;
  }

  if (slug === "whitbyos") {
    // Open Whitby referral on entry; product trial → In Progress (not commissionable).
    try {
      const { ensurePlatformReferralOnEntry } = await import(
        "@/partner-center/lib/referral-capture/ensure-platform-on-entry"
      );
      await ensurePlatformReferralOnEntry();
    } catch {
      // Attribution must never block Whitby.
    }
  }

  return children;
}
