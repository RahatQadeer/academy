import { LiveMessages } from "@/partner-center/messages/components/LiveMessages";
import { MarkMessagesRead } from "@/partner-center/messages/components/MarkMessagesRead";
import { MessagesListRail } from "@/partner-center/messages/components/MessagesListRail";
import { PartnerThreadPane } from "@/partner-center/messages/components/PartnerThreadPane";
import { RequestMessageNotifications } from "@/partner-center/messages/components/RequestMessageNotifications";
import type { MessagesPageData } from "@/partner-center/messages/types";

export function MessagesView({ data }: { data: MessagesPageData }) {
  const hasMessages = data.messages.length > 0;
  const partnerName =
    data.messages.find((m) => m.isMine)?.authorName ??
    data.messages.find((m) => m.senderType === "partner")?.authorName ??
    "You";
  const partnerInitials =
    data.messages.find((m) => m.isMine)?.authorInitials ??
    data.messages.find((m) => m.senderType === "partner")?.authorInitials ??
    "YO";

  return (
    <div className="flex min-h-0 flex-1 p-3">
      <div
        className="pa-chat-pane flex min-h-0 min-w-0 flex-1 overflow-hidden rounded-[16px]"
        style={{
          boxShadow:
            "0 1px 2px rgba(15,15,15,.06), 0 10px 28px -14px rgba(15,15,15,.14)",
        }}
      >
        <MessagesListRail
          messages={data.messages}
          unreadCount={data.unreadCount}
        />
        <PartnerThreadPane
          profileId={data.profileId}
          messages={data.messages}
          partnerName={partnerName}
          partnerInitials={partnerInitials}
          canSend={data.canSend}
          companyName={data.companyName}
          channel={data.channel}
        />
      </div>
      {hasMessages ? (
        <MarkMessagesRead
          profileId={data.profileId}
          messageCount={data.messages.filter((m) => !m.isMine).length}
        />
      ) : null}
      <LiveMessages enabled={data.liveEnabled} profileId={data.profileId} />
      <RequestMessageNotifications />
    </div>
  );
}
