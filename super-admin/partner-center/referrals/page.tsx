import { Button } from "@/base/components/Button";
import { PartnerCenterAdminShell } from "@/super-admin/partner-center/components/PartnerCenterAdminShell";
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
import { PC_ADMIN } from "@/super-admin/partner-center/lib/paths";

export default async function ReferralsAdminPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const tab = parseReferralTab(searchParams?.tab);
  const result = await loadAdminReferrals(tab);

  return (
    <PartnerCenterAdminShell>
      <div className={PARTNER_PAGE_GUTTER}>
        <AdminPageHeader
          title="Referrals"
          description="Academy and Whitby referral activity."
          action={
            <Button
              href={PC_ADMIN.referralNew}
              variant="primary"
              unsized
              className="px-3.5 py-2 text-[13.5px]"
            >
              Create referral
            </Button>
          }
        />
        <AdminDataNotice configured={result.configured} />
        {result.error ? (
          <AdminLoadError message={result.error} retryHref={PC_ADMIN.referrals} />
        ) : null}
        <ReferralsView items={result.items} activeTab={tab} />
      </div>
    </PartnerCenterAdminShell>
  );
}
