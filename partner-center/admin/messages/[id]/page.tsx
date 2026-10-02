import { PartnerAdminShell } from "@/partner-center/admin/components/PartnerAdminShellServer";
import { MessagesInboxView } from "@/super-admin/partner-center/messages/components/MessagesInboxView";
import {
  loadMessageThread,
  loadMessageThreads,
} from "@/super-admin/partner-center/messages/lib/load-messages";
import { partnerAdminSendMessageAction } from "@/partner-center/admin/lib/actions";

export default async function PartnerAdminMessageThreadPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [threads, thread] = await Promise.all([
    loadMessageThreads({ channel: "partner_manager" }),
    loadMessageThread(id, { channel: "partner_manager" }),
  ]);

  return (
    <PartnerAdminShell>
      <MessagesInboxView
        items={threads.items}
        selected={thread.data}
        configured={threads.configured && thread.configured}
        error={threads.error || thread.error}
        liveEnabled={threads.configured}
        sendAction={partnerAdminSendMessageAction}
      />
    </PartnerAdminShell>
  );
}
