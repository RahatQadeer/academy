/**
 * Shared copy: what a Client Workspace is, when to use one, and what to do
 * with none yet. Used in onboarding and Workspace Settings so the two screens
 * do not drift.
 */
export const CLIENT_WORKSPACE_EXPLAIN = {
  what: {
    title: "What is a Workspace?",
    body: "A Workspace is a separate space for one client relationship. That client's requests, people, documents and portal live there, kept apart from your other clients.",
  },
  when: {
    title: "When do you use it?",
    body: "Use it when you coordinate work for more than one client, family or household and need each relationship's work in its own place.",
  },
  none: {
    title: "If you do not have clients yet",
    body: "Choose No. You will work in one organization workspace. You can turn Workspaces on later from Settings, Workspace.",
  },
} as const;
