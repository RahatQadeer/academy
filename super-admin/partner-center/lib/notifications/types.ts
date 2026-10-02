export type PartnerAdminNotificationKind =
  | "application_submitted"
  | "application_info_resubmitted"
  | "opportunity_submitted"
  | "opportunity_updated"
  | "payment_unmatched"
  | "partner_message";

export type PartnerAdminNotificationRow = {
  id: string;
  kind: PartnerAdminNotificationKind | string;
  title: string;
  body: string | null;
  href: string | null;
  entity_type: string | null;
  entity_id: string | null;
  created_at: string;
};

export type AdminNotificationItem = {
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
