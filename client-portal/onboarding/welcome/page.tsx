import { Button } from "@/base/components/Button";
import { getPortalContext, portalFirmName } from "@/client-portal/lib/portal-context";
import { Card } from "@/client-portal/components/Surface";
import { OnboardingLayout } from "../components/OnboardingLayout";

const CAPABILITIES = [
  {
    title: "See your requests and where they stand",
    detail: "Status, the next step, and progress updates as work moves.",
  },
  {
    title: "Handle what needs you",
    detail: "Forms, documents to review, approvals and confirmations, all in one place.",
  },
  {
    title: "Message your team",
    detail: "Ask a question or reply on any request.",
  },
  {
    title: "Share and receive documents",
    detail: "Upload what's asked for, download what's shared, label it your way.",
  },
  {
    title: "Keep an eye on the calendar",
    detail: "Meetings, appointments, travel, and key dates.",
  },
];

export default async function OnboardingWelcomeScreen() {
  const context = await getPortalContext();
  const firstName = context.displayName.split(/\s+/)[0];

  return (
    <OnboardingLayout
      step={5}
      accountName={portalFirmName(context)}
      title={`Welcome, ${firstName}`}
      description={`Here's what you can do in the ${portalFirmName(context)} Client Portal:`}
    >
      <Card>
        <ul className="space-y-4">
          {CAPABILITIES.map((item) => (
            <li key={item.title} className="flex gap-3">
              <span
                aria-hidden
                className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full"
                style={{
                  background: "var(--success-bg)",
                  color: "var(--success-fg)",
                }}
              >
                <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                  <path
                    d="M2 6.2L4.6 8.8L10 3.2"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
              <div>
                <div className="text-[14.5px] font-medium">{item.title}</div>
                <div
                  className="text-[13px] leading-relaxed"
                  style={{ color: "var(--text-secondary)" }}
                >
                  {item.detail}
                </div>
              </div>
            </li>
          ))}
        </ul>
      </Card>

      <div className="mt-6">
        <Button href="/client-portal" variant="primary">
          Get Started in Your Client Portal
        </Button>
      </div>
    </OnboardingLayout>
  );
}
