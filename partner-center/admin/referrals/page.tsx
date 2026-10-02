import { PartnerAdminShell } from "@/partner-center/admin/components/PartnerAdminShellServer";
import { PARTNER_PAGE_GUTTER } from "@/partner-center/lib/layout";
import {
  AdminDataNotice,
  AdminLoadError,
} from "@/super-admin/partner-center/components/AdminDataNotice";
import { AdminPageHeader } from "@/super-admin/partner-center/components/AdminPageHeader";
import { ReferralsView } from "@/super-admin/partner-center/referrals/components/ReferralsView";
import {
  loadAdminReferrals,
  parseReferralTab,
} from "@/super-admin/partner-center/lib/load-admin-data";
import { PA_ADMIN } from "@/partner-center/admin/lib/paths";

type SearchParams = Record<string, string | string[] | undefined>;

export default async function PartnerAdminReferralsPage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  const tab = parseReferralTab(searchParams?.tab);
  const result = await loadAdminReferrals(tab);

  return (
    <PartnerAdminShell>
      <div className={PARTNER_PAGE_GUTTER}>
        <AdminPageHeader
          title="Referrals"
          description="Referral pipeline by partner — view only."
        />
        <AdminDataNotice configured={result.configured} />
        {result.error ? (
          <AdminLoadError message={result.error} retryHref={PA_ADMIN.referrals} />
        ) : null}
        <ReferralsView items={result.items} activeTab={tab} />
      </div>
    </PartnerAdminShell>
  );
}
