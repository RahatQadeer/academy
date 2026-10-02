export type PartnerNotificationKind =
  | "opportunity_status"
  | "new_message"
  | "new_referral"
  | "referral_status"
  | "earnings_payable"
  | "payout_paid"
  | "action_needed";

export type PartnerNotificationRow = {
  id: string;
  kind: PartnerNotificationKind | string;
  title: string;
  body: string | null;
  href: string | null;
  entity_type: string | null;
  entity_id: string | null;
  created_at: string;
};

export type PartnerNotificationItem = {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  href: string | null;
  createdAt: string;
  read: boolean;
  /** ISO read_at when marked read; null if unread. Used for 24h visibility. */
  readAt: string | null;
};

/** How long a read notification stays visible in the bell after read_at. */
export const NOTIFICATION_READ_VISIBLE_MS = 24 * 60 * 60 * 1000;

export function isNotificationVisibleInBell(input: {
  read: boolean;
  readAt: string | null;
  now?: number;
}): boolean {
  if (!input.read) return true;
  if (!input.readAt) return false;
  const readMs = Date.parse(input.readAt);
  if (Number.isNaN(readMs)) return false;
  const now = input.now ?? Date.now();
  return now - readMs < NOTIFICATION_READ_VISIBLE_MS;
}
