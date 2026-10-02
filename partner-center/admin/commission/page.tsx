import { PartnerAdminShell } from "@/partner-center/admin/components/PartnerAdminShellServer";
import { requirePartnerAdmin } from "@/partner-center/admin/lib/require-partner-admin";
import { PARTNER_PAGE_GUTTER } from "@/partner-center/lib/layout";
import { AdminPageHeader } from "@/super-admin/partner-center/components/AdminPageHeader";
import { createAdminClient } from "@/super-admin/partner-center/lib/admin-client";
import { loadGlobalCommissionRules } from "@/super-admin/partner-center/services/saveCommissionDefaults";

export default async function PartnerAdminCommissionPage() {
  await requirePartnerAdmin();
  const admin = createAdminClient();
  const rules = admin
    ? await loadGlobalCommissionRules(admin)
    : [];

  return (
    <PartnerAdminShell>
      <div className={PARTNER_PAGE_GUTTER}>
        <AdminPageHeader
          title="Commission rules"
          description="Platform defaults (view only). Editing is Super Admin only."
        />
        <div className="mt-4 flex flex-col gap-3">
          {rules.map((rule) => (
            <div key={rule.program} className="pa-partner-card px-4 py-3">
              <div className="text-[14px] font-medium capitalize">
                {rule.program.replaceAll("_", " ")}
              </div>
              <div
                className="mt-1 text-[13px]"
                style={{ color: "var(--text-secondary)" }}
              >
                {rule.rateType === "percentage"
                  ? `${rule.rateValue}%`
                  : `$${rule.rateValue}`}{" "}
                · attribution {rule.attributionWindowDays} days
              </div>
            </div>
          ))}
          {rules.length === 0 ? (
            <p className="text-[13.5px]" style={{ color: "var(--text-secondary)" }}>
              No global commission rules configured.
            </p>
          ) : null}
        </div>
      </div>
    </PartnerAdminShell>
  );
}
