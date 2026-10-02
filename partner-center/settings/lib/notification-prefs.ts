import {
  defaultNotificationPrefs,
  type NotificationChannelPrefs,
  type NotificationPrefs,
} from "@/partner-center/settings/types";

function asChannel(
  value: unknown,
  fallback: NotificationChannelPrefs,
): NotificationChannelPrefs {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ...fallback };
  }
  const source = value as Record<string, unknown>;
  return {
    email: typeof source.email === "boolean" ? source.email : fallback.email,
    in_app:
      typeof source.in_app === "boolean" ? source.in_app : fallback.in_app,
  };
}

export function parseNotificationPrefs(raw: unknown): NotificationPrefs {
  const defaults = defaultNotificationPrefs();
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return defaults;

  const source =
    "notification_prefs" in (raw as object)
      ? ((raw as { notification_prefs?: unknown }).notification_prefs as unknown)
      : raw;

  if (!source || typeof source !== "object" || Array.isArray(source)) {
    return defaults;
  }

  const row = source as Record<string, unknown>;
  return {
    new_referral: asChannel(row.new_referral, defaults.new_referral),
    referral_status: asChannel(row.referral_status, defaults.referral_status),
    opportunity_updates: asChannel(
      row.opportunity_updates,
      defaults.opportunity_updates,
    ),
    earnings_payouts: asChannel(row.earnings_payouts, defaults.earnings_payouts),
    action_needed: asChannel(row.action_needed, defaults.action_needed),
    new_message: asChannel(row.new_message, defaults.new_message),
  };
}

export function applicationDataRecord(raw: unknown): Record<string, unknown> {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    return { ...(raw as Record<string, unknown>) };
  }
  return {};
}
