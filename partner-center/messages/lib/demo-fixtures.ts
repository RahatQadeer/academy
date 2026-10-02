import type { PartnerMessage } from "@/partner-center/messages/types";

/** F53 sample thread for preview mode (no Supabase). */
export function demoMessages(partnerName = "Alex Rowan"): PartnerMessage[] {
  const partnerInitials = partnerName
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return [
    {
      id: "demo-1",
      senderType: "staff",
      authorName: "Private Attaché",
      authorInitials: "PA",
      body: "Welcome to Partner Center. This is your secure line with Private Attache - feel free to reach out anytime with questions about your account, referrals, opportunities, or earnings. We're here to help.",
      sentAt: "2026-07-28T14:00:00.000Z",
      isMine: false,
    },
    {
      id: "demo-2",
      senderType: "staff",
      authorName: "Private Attaché",
      authorInitials: "PA",
      body: "Opportunity update — Kessler Group marked In Progress. Their onboarding call is scheduled for next Tuesday.",
      sentAt: "2026-08-05T16:30:00.000Z",
      isMine: false,
    },
    {
      id: "demo-3",
      senderType: "staff",
      authorName: "Private Attaché",
      authorInitials: "PA",
      body: "Your W-9 was received — confirming your tax profile is complete. Next, finish your Stripe payout setup so earnings can be paid out.",
      sentAt: "2026-08-12T11:00:00.000Z",
      isMine: false,
    },
    {
      id: "demo-4",
      senderType: "partner",
      authorName: partnerName,
      authorInitials: partnerInitials,
      body: "Wanted to flag that Emerson Family Office is ready to move forward. Best contact is their COO, expecting a call this week.",
      sentAt: "2026-08-14T13:02:00.000Z",
      isMine: true,
      readStatus: "read",
    },
    {
      id: "demo-5",
      senderType: "staff",
      authorName: "Private Attaché",
      authorInitials: "PA",
      body: "Thanks for the intro on Emerson Family Office — we've reached out to schedule the intake call and will keep this thread updated as the referral progresses.",
      sentAt: "2026-08-14T15:14:00.000Z",
      isMine: false,
    },
  ];
}

export function demoUnreadCount(): number {
  return 2;
}
