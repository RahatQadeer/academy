import { redirect } from "next/navigation";
import { getSessionProfile } from "@/base/identity/session";
import { isSupabaseConfigured } from "@/base/lib/supabase/server";
import { PartnerLoadError } from "@/partner-center/components/states/PartnerLoadError";
import { HomeView } from "@/partner-center/home/components/HomeView";
import { loadHomeDashboard } from "@/partner-center/home/lib/load-home";
import { parseHomeTab } from "@/partner-center/home/types";
import { requirePartnerAppAccess } from "@/partner-center/lib/access";

type SearchParams = Record<string, string | string[] | undefined>;

export async function HomePageContent({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  if (isSupabaseConfigured()) {
    const session = await getSessionProfile();
    if (!session) {
      // Signed-out visitors sign in (or use their invite link). Apply is only
      // for new partner applicants — never the default bounce for invitees.
      redirect("/partner-center/signin");
    }
  } else {
    redirect("/partner-center/signin");
  }

  const { context } = await requirePartnerAppAccess();
  const result = await loadHomeDashboard(context);
  const tab = parseHomeTab(searchParams?.tab);

  if (!result.ok && !result.data) {
    return <PartnerLoadError retryHref="/partner-center" message={result.error} />;
  }

  return <HomeView data={result.data!} tab={tab} />;
}
