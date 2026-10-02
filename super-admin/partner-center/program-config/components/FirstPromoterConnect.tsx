"use client";

import { AdminDetailSection } from "@/super-admin/partner-center/components/AdminDetailSections";

export function FirstPromoterConnect({
  enabled,
  accountId,
}: {
  enabled: boolean;
  accountId: string | null;
}) {
  return (
    <AdminDetailSection title="FirstPromoter" variant="form">
      <p className="mb-3 text-[13px]" style={{ color: "var(--text-secondary)" }}>
        External referral layer. Enable it under Attribution.
      </p>
      <dl className="grid gap-2 text-[13.5px]">
        <div className="flex gap-2">
          <dt style={{ color: "var(--text-tertiary)" }}>Status</dt>
          <dd>{enabled ? "Enabled" : "Disabled"}</dd>
        </div>
        <div className="flex gap-2">
          <dt style={{ color: "var(--text-tertiary)" }}>Account ID</dt>
          <dd>{accountId?.trim() || "—"}</dd>
        </div>
        <div className="flex gap-2">
          <dt style={{ color: "var(--text-tertiary)" }}>Webhook</dt>
          <dd className="font-mono text-[12.5px]">
            POST /api/partner-center/firstpromoter/webhook
          </dd>
        </div>
        <div className="flex gap-2">
          <dt style={{ color: "var(--text-tertiary)" }}>API key env</dt>
          <dd className="font-mono text-[12.5px]">FIRSTPROMOTER_API_KEY</dd>
        </div>
      </dl>
    </AdminDetailSection>
  );
}
