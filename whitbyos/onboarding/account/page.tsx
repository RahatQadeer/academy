import { Callout } from "@/base/components/Callout";
import { getSessionProfile } from "@/base/identity/session";
import { isSupabaseConfigured } from "@/base/lib/supabase/server";
import { PhoneField } from "@/whitbyos/onboarding/account/PhoneField";
import { PhotoField } from "@/whitbyos/onboarding/account/PhotoField";
import {
  ONBOARDING_CONTROL,
  OnboardingField,
  OnboardingShell,
} from "@/whitbyos/onboarding/components/OnboardingShell";
import { PrimaryAction } from "@/whitbyos/onboarding/components/OnboardingButtons";
import { saveAccountBasics } from "@/whitbyos/onboarding/actions";
import { param, type SearchParams } from "@/whitbyos/lib/params";

/** 4 draws three, and they are what a coordination firm's people are called. */
const ROLES = ["Owner / Principal", "Advisor", "Coordinator"];

/**
 * Screen 4 — Onboarding Step 1/5, Your Account.
 *
 * v2 puts the person before the company: their name, how to reach them, what
 * they do, and a photo. The organization is the step after, and the reference
 * says so on this one — "You'll set up your organization next."
 *
 * Email is shown and not editable. It is the address they signed up with and
 * the one every invitation and reset already goes to; changing it is an
 * identity change, and a setup wizard is the wrong place to make one.
 */
export default async function AccountOnboardingPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const profile = isSupabaseConfigured() ? await getSessionProfile() : null;
  const error = param(await searchParams, "error");

  return (
    <form action={saveAccountBasics}>
      <OnboardingShell
        step={1}
        title="Tell us about you"
        subtitle="Your personal profile. You'll set up your organization next."
        footer={
          <div className="flex justify-end">
            <PrimaryAction>Continue</PrimaryAction>
          </div>
        }
      >
        {error ? <Callout tone="danger">{error}</Callout> : null}

        {/* Two to a line: this step is five short things and fits on one
            screen when it is not a single column of full-width boxes. */}
        <div className="grid gap-4 sm:grid-cols-2">
        <OnboardingField label="Full Name" htmlFor="fullName" required>
          <input
            id="fullName"
            name="fullName"
            required
            /* Two letters is not a name, and 80 is more than any of them. The
               browser says so before the form is sent. */
            minLength={2}
            maxLength={80}
            autoComplete="name"
            placeholder="Enter your full name"
            defaultValue={profile?.user.full_name ?? ""}
            className={ONBOARDING_CONTROL}
          />
        </OnboardingField>

        {/* Not editable here: it is the address this account signs in with,
            and changing it is a different act with a verification behind it. */}
        <OnboardingField label="Email Address" htmlFor="email">
          <input
            id="email"
            name="email"
            type="email"
            readOnly
            defaultValue={profile?.user.email ?? ""}
            className={ONBOARDING_CONTROL}
            style={{ color: "var(--text-secondary)" }}
          />
        </OnboardingField>
        </div>

        {/* The same two columns as the row above it, so Email and Your Role
            begin at the same place and the card reads as a grid rather than
            as four boxes of assorted widths. */}
        <div className="grid gap-4 sm:grid-cols-2">
        <OnboardingField label="Phone" hint="(optional)" htmlFor="phone">
          <PhoneField
            id="phone"
            name="phone"
            defaultValue={profile?.user.phone ?? ""}
            className={ONBOARDING_CONTROL}
          />
        </OnboardingField>

        <OnboardingField label="Your Role" htmlFor="role" required>
          <select
            id="role"
            name="role"
            required
            /* Back should not cost somebody an answer they already gave. */
            defaultValue={profile?.user.title_role ?? ROLES[0]}
            className={ONBOARDING_CONTROL}
          >
            {ROLES.map((role) => (
              <option key={role} value={role}>
                {role}
              </option>
            ))}
          </select>
        </OnboardingField>
        </div>

        <OnboardingField
          label="Profile photo"
          hint="(optional)"
          note="PNG or JPG, up to 2MB"
        >
          <PhotoField
            id="photo"
            name="photo"
            className={ONBOARDING_CONTROL}
            currentUrl={profile?.user.avatar_url ?? null}
          />
        </OnboardingField>
      </OnboardingShell>
    </form>
  );
}
