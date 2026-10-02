import type { MessageReadStatus } from "@/partner-center/messages/lib/read-status";

export type AdminMessageSender = "partner" | "staff";

export type AdminMessageThreadItem = {
  profileId: string;
  companyName: string;
  contactName: string;
  contactEmail: string;
  status: string;
  lastBody: string | null;
  lastSenderType: AdminMessageSender | null;
  lastSenderName: string | null;
  lastSentAt: string | null;
  needsReply: boolean;
  unreadFromPartner: boolean;
  messageCount: number;
};

export type AdminThreadMessage = {
  id: string;
  senderType: AdminMessageSender;
  authorName: string;
  authorInitials: string;
  body: string;
  sentAt: string;
  isStaff: boolean;
  readStatus?: MessageReadStatus;
};

export type AdminMessageThread = {
  profileId: string;
  companyName: string;
  contactName: string;
  contactEmail: string;
  status: string;
  messages: AdminThreadMessage[];
  partnerLastReadAt: string | null;
};
