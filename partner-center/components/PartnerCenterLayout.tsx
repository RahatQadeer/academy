import { redirect } from "next/navigation";
import { getSessionProfile } from "@/base/identity/session";
import { isSupabaseConfigured } from "@/base/lib/supabase/server";
import { PartnerAppShell } from "@/partner-center/components/PartnerAppShell";
import { resolvePartner } from "@/partner-center/lib/resolve-partner";
import { PA_ADMIN } from "@/partner-center/admin/lib/paths";

/**
 * App chrome for Partner Center product routes (not admin, not auth).
 * Partner Admins without a partner profile never belong here — divert them
 * to the admin shell the same way Company & Team invitees skip Apply.
 */
export async function PartnerCenterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (isSupabaseConfigured()) {
    const session = await getSessionProfile();
    if (session?.user?.email) {
      const { resolvePartnerAdminPostAuthLanding } = await import(
        "@/partner-center/admin/lib/invite"
      );
      const adminLanding = await resolvePartnerAdminPostAuthLanding({
        userId: session.user.id,
        email: session.user.email,
      });
      if (adminLanding) {
        const entitled = session.entitlements.some(
          (item) =>
            item.product === "partner_center" &&
            (item.status === "active" || item.status === "trial"),
        );
        const context = entitled
          ? await resolvePartner(session.user, session.entitlements)
          : null;
        // Staff-only Partner Admins → admin shell. Someone who is also a
        // real partner keeps the product shell.
        if (!context?.profile) {
          redirect(adminLanding || PA_ADMIN.root);
        }
      }
    }
  }

  return <PartnerAppShell>{children}</PartnerAppShell>;
}
