import { Input } from "@/base/components/Input";
import { getPortalContext } from "@/client-portal/lib/portal-context";
import { savePreferences } from "@/client-portal/lib/actions/settings";
import { DataNotice } from "@/client-portal/components/DataNotice";
import {
  FieldGroup,
  FormActions,
  Select,
  Textarea,
} from "@/client-portal/components/Fields";
import { SubmitButton } from "@/client-portal/components/SubmitButton";
import { SettingsShell } from "../components/SettingsShell";

export default async function PreferencesSettingsScreen() {
  const context = await getPortalContext();

  return (
    <SettingsShell
      active="preferences"
      title="Preferences"
      description="A few useful preferences, not an oversized profile."
    >
      <DataNotice context={context} />
      <form action={savePreferences}>
        <FieldGroup>
          <Select
            label="Preferred way to reach you"
            name="preferredChannel"
            placeholder="Select a channel"
            options={[
              { value: "portal", label: "Portal messages" },
              { value: "email", label: "Email" },
              { value: "phone", label: "Phone" },
              { value: "text", label: "Text message" },
            ]}
          />
          <Select
            label="How often you want progress updates"
            name="updateFrequency"
            placeholder="Select a cadence"
            options={[
              { value: "as_it_happens", label: "As it happens" },
              { value: "daily", label: "Daily summary" },
              { value: "weekly", label: "Weekly summary" },
              { value: "milestones", label: "Only at milestones" },
            ]}
          />
          <Input
            label="Preferred language"
            name="language"
            maxLength={60}
            placeholder="e.g. English"
          />
          <Textarea
            label="Accessibility considerations"
            name="accessibility"
            rows={3}
            placeholder="Anything we should keep in mind when scheduling or sharing documents."
          />
        </FieldGroup>

        <FormActions>
          <SubmitButton pendingLabel="Saving…">Save changes</SubmitButton>
        </FormActions>
      </form>
    </SettingsShell>
  );
}
