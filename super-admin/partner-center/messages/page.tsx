import { PartnerCenterAdminShell } from "@/super-admin/partner-center/components/PartnerCenterAdminShell";
import { MessagesInboxView } from "@/super-admin/partner-center/messages/components/MessagesInboxView";
import { loadMessageThreads } from "@/super-admin/partner-center/messages/lib/load-messages";

export default async function MessagesAdminPage() {
  const result = await loadMessageThreads();

  return (
    <PartnerCenterAdminShell>
      <MessagesInboxView
        items={result.items}
        selected={null}
        configured={result.configured}
        error={result.error}
        liveEnabled={result.configured}
      />
    </PartnerCenterAdminShell>
  );
}
