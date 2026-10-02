import { portalDefaultAreas } from "@/whitbyos/lib/portal-defaults";
import { Button } from "@/base/components/Button";
import { Callout } from "@/base/components/Callout";
import { getPortalContext, portalFirmName } from "@/client-portal/lib/portal-context";
import { listAccessRequests } from "@/client-portal/lib/data/people";
import {
  finishPeopleStep,
  requestAccessDuringOnboarding,
} from "@/client-portal/lib/actions/onboarding";
import { flag, type ScreenProps } from "@/client-portal/lib/routing";
import { EmptyState } from "@/client-portal/components/States";
import { CancelLink, FormActions } from "@/client-portal/components/Fields";
import { SubmitButton } from "@/client-portal/components/SubmitButton";
import { AccessRequestList } from "@/client-portal/settings/people/components/AccessRequestList";
import { AddPersonModal } from "@/client-portal/settings/people/components/AddPersonModal";
import { OnboardingLayout } from "../components/OnboardingLayout";

const PATH = "/client-portal/onboarding/people";

export default async function OnboardingPeopleScreen({ searchParams }: ScreenProps) {
  const [context, requests] = await Promise.all([
    getPortalContext(),
    listAccessRequests(),
  ]);

  // The area as well as the account capability, so the screen offers exactly
  // what `requestAccessDuringOnboarding` will accept. The step is written for
  // the primary member, who holds both.
  const canRequest = context.areas.people && context.capabilities.mayRequestAccess;

  return (
    <OnboardingLayout
      step={3}
      accountName={portalFirmName(context)}
      title="People & access"
      description="Is there anyone else who should be on this account? A spouse, an assistant, an accountant."
    >
      <Callout tone="info" className="mb-5">
        You can ask for someone to be added, but you can&apos;t grant access
        yourself. Your team reviews every request first.
      </Callout>

      {!canRequest ? (
        <EmptyState
          title="Your team manages access"
          body="Contact them directly if someone else needs to be on this account."
        />
      ) : requests.length === 0 ? (
        <EmptyState
          title="No one requested yet"
          body="This step is optional, you can always do it later under Profile & Settings."
          actionLabel="Add a person"
          actionHref={`${PATH}?add=1`}
        />
      ) : (
        <>
          <AccessRequestList requests={requests} />
          <div className="mt-3">
            <Button href={`${PATH}?add=1`} variant="secondary">
              Add another person
            </Button>
          </div>
        </>
      )}

      <form action={finishPeopleStep}>
        <input type="hidden" name="requestedCount" value={requests.length} />
        <FormActions>
          <CancelLink href="/client-portal/onboarding/welcome">Skip for now</CancelLink>
          <SubmitButton pendingLabel="Continuing…">Submit request & continue</SubmitButton>
        </FormActions>
      </form>

      {flag(searchParams, "add") && canRequest ? (
        <AddPersonModal
          closeHref={PATH}
          returnTo={PATH}
          action={requestAccessDuringOnboarding}
          defaultAreas={await portalDefaultAreas(context.workspaceId)}
        />
      ) : null}
    </OnboardingLayout>
  );
}
