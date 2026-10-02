import { requirePartnerAppAccess } from "@/partner-center/lib/access";
import { SettingsShell } from "@/partner-center/settings/components/SettingsShell";
import { SecuritySettingsView } from "@/partner-center/settings/components/SecuritySettingsView";
import { loadSettingsProfile } from "@/partner-center/settings/lib/load-settings-profile";
import { loadPartnerAuthSessions } from "@/partner-center/settings/lib/load-sessions";
import { loadPartnerMfaState } from "@/partner-center/settings/lib/security-state";

export default async function PartnerSettingsSecurityPage() {
  const access = await requirePartnerAppAccess();
  const [data, mfa, sessions] = await Promise.all([
    loadSettingsProfile(access),
    loadPartnerMfaState(),
    loadPartnerAuthSessions(),
  ]);

  return (
    <SettingsShell active="security" title="Security">
      <SecuritySettingsView
        passwordChangedAt={data.passwordChangedAt}
        mfa={mfa}
        sessions={sessions}
      />
    </SettingsShell>
  );
}
