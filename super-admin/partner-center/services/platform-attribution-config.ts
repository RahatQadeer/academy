import type { SupabaseClient } from "@supabase/supabase-js";
import type { RefundRule } from "@/partner-center/lib/attribution/eligible-revenue";
import { writePartnerAdminAudit } from "@/super-admin/partner-center/lib/admin-audit";

export type AttributionMode = "first_touch" | "last_touch";

export type ConversionEligibility = {
  academy: {
    paid_enrollment: boolean;
    free_enrollment: boolean;
  };
  platform: {
    first_paid_subscription: boolean;
    trial: boolean;
    account_creation: boolean;
  };
};

export type PlatformAttributionConfig = {
  id: string;
  defaultCookieLifeDays: number;
  attributionMode: AttributionMode;
  defaultRefundRule: RefundRule;
  conversionEligibility: ConversionEligibility;
  firstpromoterEnabled: boolean;
  firstpromoterAccountId: string | null;
};

export type PlatformAttributionConfigInput = {
  defaultCookieLifeDays: number;
  attributionMode: AttributionMode;
  defaultRefundRule: RefundRule;
  conversionEligibility: ConversionEligibility;
  firstpromoterEnabled: boolean;
  firstpromoterAccountId: string | null;
};

const DEFAULT_ELIGIBILITY: ConversionEligibility = {
  academy: { paid_enrollment: true, free_enrollment: false },
  platform: {
    first_paid_subscription: true,
    trial: false,
    account_creation: false,
  },
};

const DEFAULTS: Omit<PlatformAttributionConfig, "id"> = {
  defaultCookieLifeDays: 90,
  attributionMode: "first_touch",
  defaultRefundRule: "proportional",
  conversionEligibility: DEFAULT_ELIGIBILITY,
  firstpromoterEnabled: false,
  firstpromoterAccountId: null,
};

function parseEligibility(raw: unknown): ConversionEligibility {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_ELIGIBILITY };
  const obj = raw as Record<string, unknown>;
  const academy = (obj.academy ?? {}) as Record<string, unknown>;
  const platform = (obj.platform ?? {}) as Record<string, unknown>;
  return {
    academy: {
      paid_enrollment: academy.paid_enrollment !== false,
      free_enrollment: academy.free_enrollment === true,
    },
    platform: {
      first_paid_subscription: platform.first_paid_subscription !== false,
      trial: platform.trial === true,
      account_creation: platform.account_creation === true,
    },
  };
}

export async function loadPlatformAttributionConfig(
  admin: SupabaseClient,
): Promise<PlatformAttributionConfig> {
  const { data } = await admin
    .from("partner_platform_attribution_config")
    .select(
      "id, default_cookie_life_days, attribution_mode, default_refund_rule, conversion_eligibility, firstpromoter_enabled, firstpromoter_account_id",
    )
    .limit(1)
    .maybeSingle();

  if (!data) {
    return { id: "", ...DEFAULTS };
  }

  return {
    id: data.id as string,
    defaultCookieLifeDays:
      (data.default_cookie_life_days as number) ||
      DEFAULTS.defaultCookieLifeDays,
    attributionMode:
      (data.attribution_mode as AttributionMode) === "last_touch"
        ? "last_touch"
        : "first_touch",
    defaultRefundRule:
      (data.default_refund_rule as RefundRule) || DEFAULTS.defaultRefundRule,
    conversionEligibility: parseEligibility(data.conversion_eligibility),
    firstpromoterEnabled: Boolean(data.firstpromoter_enabled),
    firstpromoterAccountId:
      (data.firstpromoter_account_id as string | null) ?? null,
  };
}

export async function savePlatformAttributionConfig(input: {
  admin: SupabaseClient;
  actorUserId: string | null;
} & PlatformAttributionConfigInput): Promise<{ error?: string }> {
  if (
    !Number.isFinite(input.defaultCookieLifeDays) ||
    input.defaultCookieLifeDays < 1
  ) {
    return { error: "Cookie life must be at least 1 day." };
  }

  const existing = await loadPlatformAttributionConfig(input.admin);
  const now = new Date().toISOString();
  const payload = {
    default_cookie_life_days: Math.floor(input.defaultCookieLifeDays),
    attribution_mode: input.attributionMode,
    default_refund_rule: input.defaultRefundRule,
    conversion_eligibility: input.conversionEligibility,
    firstpromoter_enabled: input.firstpromoterEnabled,
    firstpromoter_account_id: input.firstpromoterAccountId?.trim() || null,
    updated_by_user_id: input.actorUserId,
    updated_at: now,
  };

  if (existing.id) {
    const { error } = await input.admin
      .from("partner_platform_attribution_config")
      .update(payload)
      .eq("id", existing.id);
    if (error) return { error: error.message };
  } else {
    const { error } = await input.admin
      .from("partner_platform_attribution_config")
      .insert(payload);
    if (error) return { error: error.message };
  }

  await writePartnerAdminAudit(input.admin, {
    actorUserId: input.actorUserId,
    entityType: "partner_platform_attribution_config",
    entityId: existing.id || "singleton",
    action: "platform_attribution_config_saved",
    previousValue: existing,
    newValue: payload,
  });

  return {};
}

/** Whether a qualifying action is commissionable under platform config. */
export function isActionCommissionable(
  config: ConversionEligibility,
  product: "academy" | "whitbyos" | "platform",
  qualifyingAction: string,
): boolean | null {
  const action = qualifyingAction.trim().toLowerCase();
  if (product === "academy") {
    if (action === "paid_enrollment") return config.academy.paid_enrollment;
    if (action === "free_enrollment") return config.academy.free_enrollment;
    return null;
  }
  if (action === "first_paid_subscription") {
    return config.platform.first_paid_subscription;
  }
  if (
    action === "trial" ||
    action === "trial_started" ||
    action === "subscription_trial_started" ||
    action === "whitby_product_trial_started"
  ) {
    return config.platform.trial;
  }
  if (action === "account_creation" || action === "signup") {
    return config.platform.account_creation;
  }
  return null;
}
