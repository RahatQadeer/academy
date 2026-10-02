import { Callout } from "@/base/components/Callout";
import { getSessionProfile } from "@/base/identity/session";
import { isSupabaseConfigured } from "@/base/lib/supabase/server";
import {
  ONBOARDING_CONTROL,
  OnboardingField,
  OnboardingShell,
} from "@/whitbyos/onboarding/components/OnboardingShell";
import {
  BackAction,
  PrimaryAction,
} from "@/whitbyos/onboarding/components/OnboardingButtons";
import { LogoPicker } from "@/whitbyos/onboarding/workspace/LogoPicker";
import { WorkTypePicker } from "@/whitbyos/onboarding/workspace/WorkTypePicker";
import { OrganizationIdentityFields } from "@/whitbyos/onboarding/workspace/OrganizationIdentityFields";
import { saveWorkspaceBasics } from "@/whitbyos/onboarding/actions";
import { getOnboardingDefaults, getOnboardingWorkspace } from "@/whitbyos/lib/onboarding";
import { param, type SearchParams } from "@/whitbyos/lib/params";

const TEAM_SIZES = [
  "Just me",
  "1–5 people",
  "6–20 people",
  "21–50 people",
  "51+ people",
];

const TIME_ZONES = [
  { value: "America/New_York", label: "Eastern Time (US)" },
  { value: "America/Chicago", label: "Central Time (US)" },
  { value: "America/Denver", label: "Mountain Time (US)" },
  { value: "America/Los_Angeles", label: "Pacific Time (US)" },
  { value: "Europe/London", label: "London (GMT/BST)" },
  { value: "Europe/Paris", label: "Central European" },
  { value: "Asia/Dubai", label: "Gulf Standard" },
  { value: "Asia/Karachi", label: "Pakistan Standard" },
  { value: "Asia/Singapore", label: "Singapore" },
  { value: "Australia/Sydney", label: "Sydney" },
];

export default async function WorkspaceOnboardingPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const profile = isSupabaseConfigured() ? await getSessionProfile() : null;
  const params = await searchParams;
  const creating = param(params, "new") === "1";
  const error = param(params, "error");

  /* What this step has already been told — going Back should not cost
     somebody the four answers they are not changing. */
  const held = creating
    ? { name: "", urlSlug: "", teamSize: "", timezone: "", workTypes: [] as string[] }
    : await getOnboardingDefaults();

  const timezone = TIME_ZONES.some((tz) => tz.value === held.timezone)
    ? held.timezone
    : TIME_ZONES.some((tz) => tz.value === profile?.user.timezone)
      ? profile?.user.timezone
      : "America/New_York";

  const teamSize = TEAM_SIZES.includes(held.teamSize) ? held.teamSize : "1–5 people";
  const workspace = creating ? null : await getOnboardingWorkspace();

  return (
    <form action={saveWorkspaceBasics}>
      <OnboardingShell
        step={2}
        title="Set up your organization"
        subtitle="Name it, give it a URL, and tell us the size of the team."
        workspace={workspace}
        footer={
          <div className="flex justify-between">
            <BackAction href="/onboarding/account" />
            <PrimaryAction>Continue</PrimaryAction>
          </div>
        }
      >
        {creating ? <input type="hidden" name="createNew" value="1" /> : null}
        {error ? <Callout tone="danger">{error}</Callout> : null}

        <OrganizationIdentityFields name={held.name} urlSlug={held.urlSlug} />

        <div className="grid gap-4 sm:grid-cols-2">
          <OnboardingField label="Team Size" htmlFor="teamSize" required>
            <select
              id="teamSize"
              name="teamSize"
              defaultValue={teamSize}
              className={ONBOARDING_CONTROL}
            >
              {TEAM_SIZES.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </OnboardingField>

          <OnboardingField label="Time Zone" htmlFor="timezone" required>
            <select
              id="timezone"
              name="timezone"
              defaultValue={timezone}
              className={ONBOARDING_CONTROL}
            >
              {TIME_ZONES.map((zone) => (
                <option key={zone.value} value={zone.value}>
                  {zone.label}
                </option>
              ))}
            </select>
          </OnboardingField>
        </div>

        <WorkTypePicker initial={held.workTypes} />

        <LogoPicker currentUrl={workspace?.logoUrl ?? null} />
      </OnboardingShell>
    </form>
  );
}
