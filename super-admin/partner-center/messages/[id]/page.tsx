import { PartnerCenterAdminShell } from "@/super-admin/partner-center/components/PartnerCenterAdminShell";
import { MessagesInboxView } from "@/super-admin/partner-center/messages/components/MessagesInboxView";
import {
  loadMessageThread,
  loadMessageThreads,
} from "@/super-admin/partner-center/messages/lib/load-messages";

export default async function MessageThreadAdminPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [threads, thread] = await Promise.all([
    loadMessageThreads(),
    loadMessageThread(id),
  ]);

  return (
    <PartnerCenterAdminShell>
      <MessagesInboxView
        items={threads.items}
        selected={thread.data}
        configured={threads.configured && thread.configured}
        error={threads.error || thread.error}
        liveEnabled={threads.configured}
      />
    </PartnerCenterAdminShell>
  );
}
