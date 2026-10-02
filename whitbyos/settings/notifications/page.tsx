import { Button } from "@/base/components/Button";
import { Submit } from "@/base/components/Submit";
import { Callout } from "@/base/components/Callout";
import { Toast } from "@/whitbyos/components/Toast";
import { SettingsShell } from "@/whitbyos/settings/components/SettingsShell";
import { NotificationToggles } from "@/whitbyos/settings/components/NotificationToggles";
import { saveNotifications } from "@/whitbyos/settings/actions";
import { getNotificationPrefs } from "@/whitbyos/lib/settings";

const PATH = "/whitbyos/settings/notifications";

function one(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

/** Screen 17.3 — Notifications. */
export default async function NotificationSettingsPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const prefs = await getNotificationPrefs();
  const toast = one(searchParams?.toast);
  const error = one(searchParams?.error);

  return (
    <SettingsShell active="notifications" title="Notifications" width={600}>
      {error ? (
        <div className="mb-5">
          <Callout tone="danger">{error}</Callout>
        </div>
      ) : null}

      <form action={saveNotifications}>
        <NotificationToggles prefs={prefs} />

        {/* Said once rather than on every row: none of the email ones can
            actually send yet, and a screen of switches that quietly do nothing
            is worse than one that says so. */}
        <p className="mt-5 text-[12.5px]" style={{ color: "var(--text-tertiary)" }}>
          These are saved against your account. Email notifications will start
          arriving once an email account is connected under Integrations. Nothing is
          sent from Whitby until then.
        </p>

        <div className="mt-6 flex justify-end">
          <Submit unsized variant="primary" className="px-[18px] py-[9px] text-[13.5px]">
            Save changes
          </Submit>
        </div>
      </form>

      {toast ? <Toast title="Settings saved" detail={toast} closeHref={PATH} /> : null}
    </SettingsShell>
  );
}
