import { type ReactNode } from "react";
import { cn } from "@/base/lib/cn";
import { getSessionProfile } from "@/base/identity/session";
import { isSupabaseConfigured } from "@/base/lib/supabase/server";
import { AcademySidebar } from "@/academy/components/AcademySidebar";
import { buildAcademyNav } from "@/academy/lib/buildNav";
import { academyRoleCssVars } from "@/academy/lib/roleTheme";

export async function AcademyAppShell({
  pathname,
  children,
}: {
  pathname: string;
  children: ReactNode;
}) {
  // Belt-and-suspenders: never paint the sidebar during learner onboarding.
  if (pathname.startsWith("/academy/onboarding") || pathname.includes("/academy/onboarding/")) {
    return (
      <div className="min-h-screen bg-canvas" data-academy-surface="onboarding">
        {children}
      </div>
    );
  }

  const configured = isSupabaseConfigured();
  const [profile, nav] = await Promise.all([
    configured ? getSessionProfile() : Promise.resolve(null),
    buildAcademyNav(pathname),
  ]);

  return (
    <div
      className={cn(
        "pa-app-shell flex overflow-hidden bg-canvas print:static print:block print:h-auto print:max-h-none print:overflow-visible",
        nav.context === "learner" && "academy-learner-shell",
      )}
      data-academy-role={nav.context}
      style={academyRoleCssVars(nav.context)}
    >
      <AcademySidebar
        context={nav.context}
        items={nav.items}
        groups={nav.groups}
        badges={null}
        roles={nav.roles}
        userName={profile?.user.preferred_name || profile?.user.full_name || "You"}
        userEmail={profile?.user.email}
        entitlements={profile?.entitlements}
        previewAll={!configured}
      />
      <main className="pa-app-shell-main flex min-h-0 min-w-0 max-w-full flex-1 flex-col overflow-x-clip overflow-y-auto print:block print:h-auto print:min-h-0 print:overflow-visible">
        {/*
          flex-1 + min-h-0 gives builders a definite height without locking
          every page to h-full (which, with overflow:hidden on a page root,
          clips content and kills main-pane scroll).
        */}
        <div className="flex min-h-0 min-w-0 max-w-full flex-1 flex-col print:min-h-0">
          {children}
        </div>
      </main>
    </div>
  );
}
