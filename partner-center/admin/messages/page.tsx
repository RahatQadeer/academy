import { PartnerAdminShell } from "@/partner-center/admin/components/PartnerAdminShellServer";
import { MessagesInboxView } from "@/super-admin/partner-center/messages/components/MessagesInboxView";
import { loadMessageThreads } from "@/super-admin/partner-center/messages/lib/load-messages";
import { partnerAdminSendMessageAction } from "@/partner-center/admin/lib/actions";

export default async function PartnerAdminMessagesPage() {
  const result = await loadMessageThreads({ channel: "partner_manager" });

  return (
    <PartnerAdminShell>
      <MessagesInboxView
        items={result.items}
        selected={null}
        configured={result.configured}
        error={result.error}
        liveEnabled={result.configured}
        sendAction={partnerAdminSendMessageAction}
      />
    </PartnerAdminShell>
  );
}
