import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { loadPlatformTaxConfig } from "@/super-admin/partner-center/services/platform-tax-config";
import { writePartnerAdminAudit } from "@/super-admin/partner-center/lib/admin-audit";

export type Partner1099Status =
  | "not_started"
  | "in_progress"
  | "complete"
  | "filed";

export type Partner1099RollupRow = {
  id: string;
  taxYear: number;
  legalPayerEntity: string;
  partnerProfileId: string;
  companyName: string;
  reportableTotal: number;
  stripePaidTotal: number;
  quickbooksPaidTotal: number;
  adjustments: number;
  status: Partner1099Status;
  reference: string | null;
};

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

export async function generate1099Rollups(
  admin: SupabaseClient,
  input: { taxYear: number; actorUserId: string | null },
): Promise<{ error?: string; count?: number }> {
  const year = Math.floor(input.taxYear);
  if (!Number.isFinite(year) || year < 2000 || year > 2100) {
    return { error: "Enter a valid tax year." };
  }

  const config = await loadPlatformTaxConfig(admin);
  const legalPayerEntity = config.legalPayerEntity.trim();
  if (!legalPayerEntity) {
    return { error: "Set legal payer entity in Program config first." };
  }

  const yearStart = `${year}-01-01T00:00:00.000Z`;
  const yearEnd = `${year + 1}-01-01T00:00:00.000Z`;

  const { data: payouts, error } = await admin
    .from("partner_payouts")
    .select("partner_profile_id, amount, method, paid_at")
    .eq("status", "paid")
    .gte("paid_at", yearStart)
    .lt("paid_at", yearEnd);

  if (error) return { error: error.message };

  const byPartner = new Map<
    string,
    { stripe: number; quickbooks: number }
  >();

  for (const row of payouts ?? []) {
    const partnerId = row.partner_profile_id as string;
    const amount = Number(row.amount) || 0;
    const method = (row.method as string) || "";
    const bucket = byPartner.get(partnerId) ?? { stripe: 0, quickbooks: 0 };
    if (method === "stripe_connect") {
      bucket.stripe += amount;
    } else {
      // v1: ach/check fold into non-Stripe (quickbooks_paid_total)
      bucket.quickbooks += amount;
    }
    byPartner.set(partnerId, bucket);
  }

  const now = new Date().toISOString();
  let count = 0;

  for (const [partnerProfileId, totals] of byPartner) {
    const stripePaidTotal = round2(totals.stripe);
    const quickbooksPaidTotal = round2(totals.quickbooks);
    const reportableTotal = round2(stripePaidTotal + quickbooksPaidTotal);

    const { data: existing } = await admin
      .from("partner_1099_rollups")
      .select("id, status, reference, adjustments")
      .eq("tax_year", year)
      .eq("legal_payer_entity", legalPayerEntity)
      .eq("partner_profile_id", partnerProfileId)
      .maybeSingle();

    const payload = {
      tax_year: year,
      legal_payer_entity: legalPayerEntity,
      partner_profile_id: partnerProfileId,
      reportable_total: reportableTotal,
      stripe_paid_total: stripePaidTotal,
      quickbooks_paid_total: quickbooksPaidTotal,
      adjustments: existing
        ? Number(existing.adjustments) || 0
        : 0,
      status: (existing?.status as Partner1099Status) || "not_started",
      reference: (existing?.reference as string | null) ?? null,
      updated_at: now,
    };

    if (existing?.id) {
      const { error: updateError } = await admin
        .from("partner_1099_rollups")
        .update(payload)
        .eq("id", existing.id);
      if (updateError) return { error: updateError.message };
    } else {
      const { error: insertError } = await admin
        .from("partner_1099_rollups")
        .insert(payload);
      if (insertError) return { error: insertError.message };
    }
    count += 1;
  }

  await writePartnerAdminAudit(admin, {
    actorUserId: input.actorUserId,
    entityType: "partner_1099_rollups",
    entityId: String(year),
    action: "1099_rollups_generated",
    newValue: {
      tax_year: year,
      legal_payer_entity: legalPayerEntity,
      count,
    },
  });

  return { count };
}

export async function load1099Rollups(
  admin: SupabaseClient,
  taxYear: number,
): Promise<{ rows: Partner1099RollupRow[]; error?: string }> {
  const { data, error } = await admin
    .from("partner_1099_rollups")
    .select(
      "id, tax_year, legal_payer_entity, partner_profile_id, reportable_total, stripe_paid_total, quickbooks_paid_total, adjustments, status, reference",
    )
    .eq("tax_year", taxYear)
    .order("reportable_total", { ascending: false });

  if (error) return { rows: [], error: error.message };

  const rows = data ?? [];
  const partnerIds = [
    ...new Set(rows.map((r) => r.partner_profile_id as string)),
  ];

  const companyNameByPartner = new Map<string, string>();
  if (partnerIds.length > 0) {
    const { data: profiles } = await admin
      .from("partner_profiles")
      .select("id, company_id")
      .in("id", partnerIds);
    const companyIds = [
      ...new Set(
        (profiles ?? [])
          .map((p) => p.company_id as string | null)
          .filter(Boolean) as string[],
      ),
    ];
    const companyNameById = new Map<string, string>();
    if (companyIds.length > 0) {
      const { data: companies } = await admin
        .from("companies")
        .select("id, name")
        .in("id", companyIds);
      for (const c of companies ?? []) {
        companyNameById.set(c.id as string, (c.name as string) || "—");
      }
    }
    for (const p of profiles ?? []) {
      const name =
        (p.company_id && companyNameById.get(p.company_id as string)) || "—";
      companyNameByPartner.set(p.id as string, name);
    }
  }

  return {
    rows: rows.map((row) => ({
      id: row.id as string,
      taxYear: row.tax_year as number,
      legalPayerEntity: row.legal_payer_entity as string,
      partnerProfileId: row.partner_profile_id as string,
      companyName:
        companyNameByPartner.get(row.partner_profile_id as string) || "—",
      reportableTotal: Number(row.reportable_total) || 0,
      stripePaidTotal: Number(row.stripe_paid_total) || 0,
      quickbooksPaidTotal: Number(row.quickbooks_paid_total) || 0,
      adjustments: Number(row.adjustments) || 0,
      status: row.status as Partner1099Status,
      reference: (row.reference as string | null) ?? null,
    })),
  };
}

export async function update1099RollupStatus(
  admin: SupabaseClient,
  input: {
    rollupId: string;
    status: Partner1099Status;
    reference?: string | null;
    actorUserId: string | null;
  },
): Promise<{ error?: string }> {
  const { data: existing } = await admin
    .from("partner_1099_rollups")
    .select("id, status, reference")
    .eq("id", input.rollupId)
    .maybeSingle();

  if (!existing) return { error: "Rollup not found." };

  const { error } = await admin
    .from("partner_1099_rollups")
    .update({
      status: input.status,
      reference:
        input.reference !== undefined
          ? input.reference?.trim() || null
          : existing.reference,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.rollupId);

  if (error) return { error: error.message };

  await writePartnerAdminAudit(admin, {
    actorUserId: input.actorUserId,
    entityType: "partner_1099_rollups",
    entityId: input.rollupId,
    action: "1099_rollup_status_updated",
    previousValue: {
      status: existing.status,
      reference: existing.reference,
    },
    newValue: {
      status: input.status,
      reference:
        input.reference !== undefined
          ? input.reference?.trim() || null
          : existing.reference,
    },
  });

  return {};
}
