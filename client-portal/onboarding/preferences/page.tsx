import { Input } from "@/base/components/Input";
import { getPortalContext, portalFirmName } from "@/client-portal/lib/portal-context";
import {
  EVENT_LABEL,
  listNotificationPrefs,
} from "@/client-portal/lib/data/notifications";
import { saveOnboardingPreferences } from "@/client-portal/lib/actions/onboarding";
import { Card, Row, RowList } from "@/client-portal/components/Surface";
import {
  FieldGroup,
  CancelLink, FormActions,
  Select,
  Textarea,
} from "@/client-portal/components/Fields";
import { SubmitButton } from "@/client-portal/components/SubmitButton";
import { OnboardingLayout } from "../components/OnboardingLayout";

export default async function OnboardingPreferencesScreen() {
  const [context, prefs] = await Promise.all([
    getPortalContext(),
    listNotificationPrefs(),
  ]);

  return (
    <OnboardingLayout
      step={2}
      accountName={portalFirmName(context)}
      title="Communication & preferences"
      description="How you'd like to hear from your team. All of this stays editable later."
    >
      <form action={saveOnboardingPreferences}>
        <Card>
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
              placeholder="Optional"
            />
            <Textarea
              label="Accessibility considerations"
              name="accessibility"
              rows={3}
              placeholder="Optional, anything we should keep in mind."
            />
          </FieldGroup>
        </Card>

        <p
          className="mb-2 mt-6 text-[12px] font-semibold uppercase tracking-[0.05em]"
          style={{ color: "var(--text-tertiary)" }}
        >
          Email me about
        </p>
        <RowList>
          {prefs.map((pref) => (
            <Row key={pref.event}>
              <label
                htmlFor={`onb-${pref.event}`}
                className="min-w-0 flex-1 cursor-pointer text-[14px]"
              >
                {EVENT_LABEL[pref.event]}
              </label>
              <input
                id={`onb-${pref.event}`}
                type="checkbox"
                name={`event:${pref.event}`}
                defaultChecked={pref.enabled}
                className="h-4 w-4 shrink-0 accent-[var(--accent)]"
              />
            </Row>
          ))}
        </RowList>

        <FormActions>
          <CancelLink href="/client-portal/onboarding/people">Skip for now</CancelLink>
          <SubmitButton pendingLabel="Saving…">Continue</SubmitButton>
        </FormActions>
      </form>
    </OnboardingLayout>
  );
}
