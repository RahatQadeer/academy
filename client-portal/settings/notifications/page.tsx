import { getPortalContext } from "@/client-portal/lib/portal-context";
import {
  EVENT_LABEL,
  listNotificationPrefs,
} from "@/client-portal/lib/data/notifications";
import { saveNotifications } from "@/client-portal/lib/actions/settings";
import { DataNotice } from "@/client-portal/components/DataNotice";
import { Row, RowList } from "@/client-portal/components/Surface";
import { FormActions } from "@/client-portal/components/Fields";
import { SubmitButton } from "@/client-portal/components/SubmitButton";
import { SettingsShell } from "../components/SettingsShell";

export default async function NotificationSettingsScreen() {
  const [context, prefs] = await Promise.all([
    getPortalContext(),
    listNotificationPrefs(),
  ]);

  return (
    <SettingsShell
      active="notifications"
      title="Notifications"
      description="Choose what you hear about."
    >
      <DataNotice context={context} />
      <form action={saveNotifications}>
        <RowList>
          {prefs.map((pref) => (
            <Row key={pref.event}>
              <label
                htmlFor={`event-${pref.event}`}
                className="min-w-0 flex-1 cursor-pointer text-[14px]"
              >
                {EVENT_LABEL[pref.event]}
              </label>
              {/*
                A plain checkbox rather than the base Toggle: Toggle is a client
                component driven by props, and this whole page is a server form
                that posts its state in one submit.
              */}
              <input
                id={`event-${pref.event}`}
                type="checkbox"
                name={`event:${pref.event}`}
                defaultChecked={pref.enabled}
                className="h-4 w-4 shrink-0 accent-[var(--accent)]"
              />
            </Row>
          ))}
        </RowList>

        <FormActions>
          <SubmitButton pendingLabel="Saving…">Save notifications</SubmitButton>
        </FormActions>
      </form>
    </SettingsShell>
  );
}
