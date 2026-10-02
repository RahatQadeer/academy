import type { MessageReadStatus } from "@/partner-center/messages/lib/read-status";

export type PartnerMessageSender = "partner" | "staff";

export type PartnerMessage = {
  id: string;
  senderType: PartnerMessageSender;
  authorName: string;
  authorInitials: string;
  body: string;
  sentAt: string;
  isMine: boolean;
  readStatus?: MessageReadStatus;
};

export type MessagesPageData = {
  profileId: string;
  companyName: string;
  canSend: boolean;
  messages: PartnerMessage[];
  unreadCount: number;
  liveEnabled: boolean;
  staffLastReadAt: string | null;
  channel: "partner_manager" | "support_billing";
};
