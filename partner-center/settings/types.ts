export type SettingsTab = "profile" | "notifications" | "security" | "tax";

export type NotificationChannelPrefs = {
  email: boolean;
  in_app: boolean;
};

export type NotificationPrefs = {
  new_referral: NotificationChannelPrefs;
  referral_status: NotificationChannelPrefs;
  opportunity_updates: NotificationChannelPrefs;
  earnings_payouts: NotificationChannelPrefs;
  action_needed: NotificationChannelPrefs;
  new_message: NotificationChannelPrefs;
};

export type SettingsProfileData = {
  userId: string;
  contactId: string | null;
  profileId: string | null;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  title: string;
  displayName: string;
  avatarUrl: string | null;
  notificationPrefs: NotificationPrefs;
  /** ISO date when password was last changed, if known. */
  passwordChangedAt: string | null;
};

export const NOTIFICATION_ROWS: {
  key: keyof NotificationPrefs;
  label: string;
  description: string;
}[] = [
  {
    key: "new_referral",
    label: "New referral submitted",
    description: "When a lead is submitted with your link or code",
  },
  {
    key: "referral_status",
    label: "Referral status change",
    description: "Converted, not converted, or needs info",
  },
  {
    key: "opportunity_updates",
    label: "Opportunity updates",
    description:
      "Enterprise opportunity accepted, in progress, converted, or closed",
  },
  {
    key: "earnings_payouts",
    label: "Earnings & payouts",
    description: "Payable earnings and completed payouts",
  },
  {
    key: "action_needed",
    label: "Action needed",
    description: "Documents, tax, or payment setup needing your attention",
  },
  {
    key: "new_message",
    label: "New message",
    description: "From the Partnerships team or support",
  },
];

export function defaultNotificationPrefs(): NotificationPrefs {
  return {
    new_referral: { email: true, in_app: true },
    referral_status: { email: true, in_app: true },
    opportunity_updates: { email: true, in_app: true },
    earnings_payouts: { email: true, in_app: false },
    action_needed: { email: true, in_app: true },
    new_message: { email: true, in_app: true },
  };
}
