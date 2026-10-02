import { requirePartnerAppAccess } from "@/partner-center/lib/access";
import { SettingsShell } from "@/partner-center/settings/components/SettingsShell";
import { ProfileSettingsForm } from "@/partner-center/settings/components/ProfileSettingsForm";
import { loadSettingsProfile } from "@/partner-center/settings/lib/load-settings-profile";

export default async function PartnerSettingsProfilePage() {
  const access = await requirePartnerAppAccess();
  const data = await loadSettingsProfile(access);

  return (
    <SettingsShell active="profile" title="Profile">
      <ProfileSettingsForm data={data} />
    </SettingsShell>
  );
}
