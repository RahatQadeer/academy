import { Button } from "@/base/components/Button";
import { StepRow } from "@/base/components/StepRow";
import { getPortalContext, portalFirmName } from "@/client-portal/lib/portal-context";
import { listAccessRequests } from "@/client-portal/lib/data/people";
import { Card } from "@/client-portal/components/Surface";
import { OnboardingLayout } from "../components/OnboardingLayout";

/**
 * Step 4 of 5 — the professional approval workflow (SRS 4.9). Nothing here is a
 * form; it exists so the client understands their request is queued for review
 * rather than already granted.
 */
export default async function OnboardingReviewScreen() {
  const [context, requests] = await Promise.all([
    getPortalContext(),
    listAccessRequests(),
  ]);

  const pending = requests.filter((request) => request.status === "pending");

  return (
    <OnboardingLayout
      step={4}
      accountName={portalFirmName(context)}
      title="Sent for review"
      description={
        pending.length === 1
          ? "Your request is with your team. We'll email you once they've reviewed it."
          : "Your requests are with your team. We'll email you once they've been reviewed."
      }
    >
      <Card>
        {pending.length > 0 ? (
          <ul className="mb-5 space-y-1.5">
            {pending.map((request) => (
              <li key={request.id} className="text-[14px]">
                <span className="font-medium">{request.personName}</span>
                <span style={{ color: "var(--text-secondary)" }}>
                  {request.requestedRole ? ` · ${request.requestedRole}` : ""}
                  {request.personEmail ? ` · ${request.personEmail}` : ""}
                </span>
              </li>
            ))}
          </ul>
        ) : null}

        <div
          className="border-t pt-4"
          style={{ borderColor: "var(--border)" }}
        >
          <StepRow index={1} title="You requested access" done />
          <StepRow
            index={2}
            title="Your team reviews the request"
            detail="They may approve it, adjust the permissions first, or decline."
            active
          />
          <StepRow
            index={3}
            title="An invitation goes out"
            detail="Only after approval. The person sets their own password."
          />
        </div>
      </Card>

      <div className="mt-6">
        <Button href="/client-portal/onboarding/welcome" variant="primary">
          Continue
        </Button>
      </div>
    </OnboardingLayout>
  );
}
