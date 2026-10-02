import { Input } from "@/base/components/Input";
import { getPortalContext, portalFirmName } from "@/client-portal/lib/portal-context";
import { saveOnboardingProfile } from "@/client-portal/lib/actions/onboarding";
import { Card } from "@/client-portal/components/Surface";
import { FieldGroup, FormActions, Select } from "@/client-portal/components/Fields";
import { SubmitButton } from "@/client-portal/components/SubmitButton";
import { OnboardingLayout } from "../components/OnboardingLayout";

const SALUTATIONS = ["Dr.", "Mr.", "Mrs.", "Ms.", "Mx.", "Sir", "Dame"];

const TIMEZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "Europe/London",
  "Europe/Paris",
  "Asia/Dubai",
  "Asia/Singapore",
  "UTC",
];

export default async function OnboardingAboutScreen() {
  const context = await getPortalContext();

  return (
    <OnboardingLayout
      step={1}
      accountName={portalFirmName(context)}
      title="About you"
      description="Just the basics, you can add more later under Profile & Settings."
    >
      <Card>
        <form action={saveOnboardingProfile}>
          <FieldGroup>
            <Input
              label="Full name"
              name="fullName"
              required
              maxLength={120}
              defaultValue={context.displayName}
            />
            <Input
              label="Preferred name"
              name="preferredName"
              maxLength={80}
              placeholder="What should we call you?"
            />
            <Select
              label="Salutation"
              name="salutation"
              placeholder="None"
              options={SALUTATIONS.map((value) => ({ value, label: value }))}
            />
            <Input
              label="Email address"
              name="email"
              type="email"
              defaultValue={context.email ?? ""}
              readOnly
              hint="This is the address your invitation was sent to."
            />
            <Input label="Phone" name="phone" type="tel" maxLength={40} />
            <Select
              label="Time zone"
              name="timezone"
              placeholder="Select a time zone"
              options={TIMEZONES.map((value) => ({
                value,
                label: value.replace(/_/g, " "),
              }))}
            />
            <Input
              label="Company or household"
              name="organization"
              maxLength={120}
              placeholder="Optional"
            />
          </FieldGroup>

          <FormActions>
            <SubmitButton pendingLabel="Saving…">Continue</SubmitButton>
          </FormActions>
        </form>
      </Card>
    </OnboardingLayout>
  );
}
