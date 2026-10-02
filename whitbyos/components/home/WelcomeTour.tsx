import { WelcomeTour as Tour, type TourStep } from "@/base/components/WelcomeTour";

/**
 * A short first-run walkthrough after setup.
 *
 * Four steps, not six: enough to find the rail, start work, and ask Whitby.
 * Client Workspace mode gets the switcher; a firm without clients does not.
 */

const SHARED_END: TourStep = {
  target: null,
  title: "You're ready",
  body: "Start a Request, or ask Whitby to draft one. You can reopen this tour anytime from Settings.",
};

function stepsFor(usesClientWorkspaces: boolean): TourStep[] {
  const start: TourStep = usesClientWorkspaces
    ? {
        target: '[data-tour="workspace"]',
        title: "Switch workspaces",
        body: "This icon opens your workspaces. Use it to switch, create, or view all of them.",
      }
    : {
        target: '[data-tour="nav"]',
        title: "Your work is on the rail",
        body: "Requests, Work Plans, Tasks and the rest live here. Groups collapse so the list stays short.",
      };

  const middle: TourStep[] = usesClientWorkspaces
    ? [
        {
          target: '[data-tour="nav"]',
          title: "Your work is on the rail",
          body: "Relationships, Work, Communication, Content and Reporting. Click a group to open or close it.",
        },
      ]
    : [
        {
          target: '[data-tour="header-actions"]',
          title: "Search and Quick Add",
          body: "Search this workspace, or press + to start a Request, Task, note or document.",
        },
      ];

  return [
    start,
    ...middle,
    {
      target: '[data-tour="ask"]',
      title: "Ask Whitby",
      body: "Describe the work in plain language. Whitby drafts the first pass for you to review.",
    },
    SHARED_END,
  ];
}

export function WelcomeTour({
  finish,
  usesClientWorkspaces = true,
}: {
  finish: () => Promise<void>;
  usesClientWorkspaces?: boolean;
}) {
  return <Tour steps={stepsFor(usesClientWorkspaces)} finish={finish} />;
}
