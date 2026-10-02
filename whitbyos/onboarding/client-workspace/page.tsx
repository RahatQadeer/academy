import { Callout } from "@/base/components/Callout";
import {
  ONBOARDING_CONTROL,
  OnboardingField,
  OnboardingShell,
} from "@/whitbyos/onboarding/components/OnboardingShell";
import {
  BackAction,
  PrimaryAction,
} from "@/whitbyos/onboarding/components/OnboardingButtons";
import { ClientWorkspaceChoice } from "@/whitbyos/onboarding/client-workspace/ClientWorkspaceChoice";
import { ClientWorkspaceExplain } from "@/whitbyos/components/ClientWorkspaceExplain";
import { PhoneField } from "@/whitbyos/onboarding/account/PhoneField";
import { createOnboardingClient } from "@/whitbyos/onboarding/actions";
import { getOnboardingClientStep, getOnboardingWorkspace } from "@/whitbyos/lib/onboarding";
import { planFor, planLabel } from "@/whitbyos/lib/billing-vocab";
import { getCurrentWorkspacePlan } from "@/whitbyos/lib/workspace";
import { param, type SearchParams } from "@/whitbyos/lib/params";

const CLIENT_TYPES = [
  { value: "individual", label: "Individual" },
  { value: "family", label: "Family" },
  { value: "household", label: "Household" },
  { value: "company", label: "Company" },
  { value: "organization", label: "Organization" },
];

/**
 * Screen 4.2 — Onboarding Step 3/5, Client Workspace.
 *
 * Two clear answers, not a form that has to be skipped: Yes keeps a workspace
 * per client, No hides that machinery. The first client is optional even on Yes.
 */
export default async function ClientWorkspaceOnboardingPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const error = param(params, "error");
  const plan = planFor(await getCurrentWorkspacePlan());
  const limit = plan?.activeWorkspaces;
  /* What this step was told last time, so Back does not undo it. */
  const held = await getOnboardingClientStep();

  return (
    <form action={createOnboardingClient}>
      <OnboardingShell
        step={3}
        title="Workspaces"
        subtitle="Use a separate workspace per client, or work as one organization. You can change this later in Settings."
        workspace={await getOnboardingWorkspace()}
        footer={
          <div className="flex justify-between">
            <BackAction href="/onboarding/workspace" />
            <PrimaryAction>Continue</PrimaryAction>
          </div>
        }
      >
        {error ? <Callout tone="danger">{error}</Callout> : null}

        <ClientWorkspaceExplain compact />

        <ClientWorkspaceChoice initial={held.uses}>
          <div className="flex flex-col gap-4">
            <p className="text-[13.5px] leading-[1.55]" style={{ color: "var(--text-secondary)" }}>
              Name the first one. You can add the rest later from Clients.
            </p>

            {/*
              * Required once Yes is chosen.
              *
              * It was optional, so the step could be finished with the form
              * open and every box in it empty — and Continue sat there in
              * full colour saying it was ready, which is what a disabled
              * button is for avoiding. Choosing a workspace per client and
              * naming none of them is not an answer, it is the other button.
              */}
            <OnboardingField
              label="Workspace"
              htmlFor="name"
              required
              note="The relationship you are working for, a household, a company, or an individual."
            >
              <input
                id="name"
                name="name"
                required
                minLength={2}
                maxLength={80}
                placeholder="Enter name"
                defaultValue={held.name}
                className={ONBOARDING_CONTROL}
              />
            </OnboardingField>

            <OnboardingField label="Classification" htmlFor="clientType" required>
              <select
                id="clientType"
                name="clientType"
                required
                defaultValue={
                  CLIENT_TYPES.some((type) => type.value === held.clientType)
                    ? held.clientType
                    : ""
                }
                className={ONBOARDING_CONTROL}
              >
                <option value="">Select classification</option>
                {CLIENT_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </OnboardingField>

            {/*
              * The person, and how to reach them.
              *
              * A client workspace with nobody on it is a folder: every
              * Request, message and document here is addressed to somebody.
              * Portal access is a plan capability, offered later, not on
              * the step that comes before a plan is chosen.
              */}
            <OnboardingField
              label="Contact person"
              htmlFor="primaryContact"
              required
              note="The person you work with. Email and phone belong to them."
            >
              <input
                id="primaryContact"
                name="primaryContact"
                required
                minLength={2}
                maxLength={80}
                placeholder="Enter name"
                defaultValue={held.primaryContact}
                className={ONBOARDING_CONTROL}
              />
            </OnboardingField>

            <OnboardingField
              label="Contact Email"
              htmlFor="primaryContactEmail"
              required
              note="We'll use this to reach them."
            >
              <input
                id="primaryContactEmail"
                name="primaryContactEmail"
                type="email"
                required
                maxLength={120}
                placeholder="Enter email"
                defaultValue={held.primaryContactEmail}
                className={ONBOARDING_CONTROL}
              />
            </OnboardingField>

            <OnboardingField label="Phone" hint="(optional)" htmlFor="primaryContactPhone">
              <PhoneField
                id="primaryContactPhone"
                name="primaryContactPhone"
                defaultValue={held.primaryContactPhone}
                className={ONBOARDING_CONTROL}
              />
            </OnboardingField>

            {limit ? (
              <p className="text-[12.5px]" style={{ color: "var(--text-tertiary)" }}>
                Your {planLabel(plan?.value ?? null)} includes up to {limit} active client
                workspace{limit === 1 ? "" : "s"}. Archived workspaces don&apos;t count
                against this limit.
              </p>
            ) : null}
          </div>
        </ClientWorkspaceChoice>
      </OnboardingShell>
    </form>
  );
}
