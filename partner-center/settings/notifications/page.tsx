import { requirePartnerAppAccess } from "@/partner-center/lib/access";
import { SettingsShell } from "@/partner-center/settings/components/SettingsShell";
import { NotificationsSettingsForm } from "@/partner-center/settings/components/NotificationsSettingsForm";
import { loadSettingsProfile } from "@/partner-center/settings/lib/load-settings-profile";

export default async function PartnerSettingsNotificationsPage() {
  const access = await requirePartnerAppAccess();
  const data = await loadSettingsProfile(access);

  return (
    <SettingsShell
      active="notifications"
      title="Notifications"
      description="Choose how you hear about activity in the Partner Center."
    >
      <NotificationsSettingsForm initial={data.notificationPrefs} />
    </SettingsShell>
  );
}
