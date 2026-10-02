export const BUILD_STEPS = [
  "Reading the request",
  "Matching to a specialist track",
  "Drafting the work plan",
  "Estimating the timeline",
  "Finalizing",
] as const;

export const HERO_PLAN_PREVIEW = [
  {
    title: "Draft relocation timeline",
    mark: "✓",
    done: true,
    kind: "Auto",
    muted: false,
  },
  {
    title: "Confirm tax residency triggers",
    mark: "✓",
    done: true,
    kind: "Auto",
    muted: false,
  },
  {
    title: "Approve moving budget",
    mark: "",
    done: false,
    kind: "Approval",
    muted: false,
  },
  {
    title: "Schedule shipping & customs",
    mark: "",
    done: false,
    kind: "Auto",
    muted: true,
  },
] as const;

export const MODULES = [
  { key: "whitby", label: "Whitby" },
  { key: "portal", label: "Client Portal" },
  { key: "academy", label: "Academy" },
  { key: "partner", label: "Partner Center" },
] as const;

export type ModuleKey = (typeof MODULES)[number]["key"];

export const RUN_STEPS = [
  {
    title: "Draft relocation timeline",
    done: true,
    active: false,
    kind: "Auto" as const,
    detail:
      "Whitby built a six-week timeline from the move date and household size, with milestones for lease, shipping, and school enrollment.",
  },
  {
    title: "Confirm tax residency triggers",
    done: false,
    active: true,
    kind: "Approval" as const,
    detail:
      "Whitby flagged that a stay past 183 days changes residency status — waiting on your confirmation before it drafts the filing note.",
  },
  {
    title: "Approve moving budget",
    done: false,
    active: false,
    kind: "Approval" as const,
    detail:
      "A provisional budget is ready from three moving-company quotes; needs sign-off before providers are contacted.",
  },
  {
    title: "Schedule shipping & customs",
    done: false,
    active: false,
    kind: "Auto" as const,
    detail:
      "Runs automatically once the budget is approved — customs paperwork pre-filled from household inventory.",
  },
];

export const PORTAL_REQUESTS = [
  {
    title: "Zurich → Austin relocation",
    status: "On track",
    detail:
      'The client sees: next step is "confirm school enrollment", a progress update posted yesterday, and the shared moving-company option. No internal workplan, notes, or provider scoring are visible.',
  },
  {
    title: "Q3 board packet",
    status: "Waiting on you",
    detail:
      "The client sees an Action Needed item asking them to review the draft agenda, plus the two documents already shared with them.",
  },
  {
    title: "Aspen residence opening",
    status: "In progress",
    detail:
      "The client sees a simple status line and the calendar item for the opening date — the staffing plan behind it stays internal.",
  },
];

export const ACADEMY_PROGRAMS = [
  {
    title: "Certified Private Attaché",
    action: "Continue",
    detail:
      "The foundational credential — three-year term, renewable through continuing coordination hours.",
  },
  {
    title: "Private Residence Operations",
    action: "CPA Required",
    detail:
      "A Specialty Endorsement covering staffing and seasonal residence opening/closing; unlocks once the CPA is complete.",
  },
  {
    title: "Family Office Operations",
    action: "CPA Required",
    detail:
      "Entity structuring and reporting workflows for family-office engagements.",
  },
  {
    title: "Intelligent Coordination",
    action: "Start",
    detail:
      "The free, included course on working alongside Whitby — open to every learner, no prerequisite.",
  },
];

export const PARTNER_TIERS = [
  { key: "silver", label: "Silver", rate: 2200 },
  { key: "gold", label: "Gold", rate: 3400 },
  { key: "platinum", label: "Platinum", rate: 4800 },
] as const;

export type PartnerTier = (typeof PARTNER_TIERS)[number]["key"];

export const SPECIALTY_ICON_KEYS = [
  "principal-affairs",
  "family-office",
  "residence",
  "estate",
  "health",
  "travel",
  "security",
  "household",
] as const;

export type SpecialtyIconKey = (typeof SPECIALTY_ICON_KEYS)[number];

export const SPECIALTY_PROGRAMS: Array<{
  title: string;
  desc: string;
  icon: SpecialtyIconKey;
}> = [
  {
    title: "Principal Affairs",
    desc: "Calendar authority, correspondence handling, and the decision log that keeps delegation clean.",
    icon: "principal-affairs",
  },
  {
    title: "Family Office Operations",
    desc: "Entity structures, reporting cycles, and the board packet calendar.",
    icon: "family-office",
  },
  {
    title: "Private Residence Operations",
    desc: "Opening, running, and closing residences — staffing, vendors, provisioning, seasonal cycles.",
    icon: "residence",
  },
  {
    title: "Estate & Legacy Operations",
    desc: "Coordinating estate administration with counsel and trustees, without stepping into advice.",
    icon: "estate",
  },
  {
    title: "Health & Medical Coordination",
    desc: "Care coordination under strict information boundaries, from scheduling to travel-adjacent care.",
    icon: "health",
  },
  {
    title: "Travel & Global Mobility",
    desc: "Relocation and multi-country moves, including tax residency triggers and cross-border logistics.",
    icon: "travel",
  },
  {
    title: "Security & Risk Management",
    desc: "Working with security teams: travel risk, residence protocols, and incident escalation.",
    icon: "security",
  },
  {
    title: "Household & Staffing Operations",
    desc: "Hiring, onboarding, and managing household staff, including payroll and review cycles.",
    icon: "household",
  },
];

export const REFERRAL_STAGES = [
  {
    n: "1",
    title: "Submit",
    body: "Log a referral or enterprise opportunity in Partner Center, with a protection window that keeps it yours while it's worked.",
  },
  {
    n: "2",
    title: "Track",
    body: "Follow the opportunity through scoping and conversion — visible status, no chasing.",
  },
  {
    n: "3",
    title: "Convert",
    body: "Once the engagement is confirmed, the referral moves to paid status on the next commission cycle.",
  },
  {
    n: "4",
    title: "Get paid",
    body: "Commissions post on a fixed schedule for every converted referral, at your program tier's rate.",
  },
];

export const COMPARE_BEFORE = [
  '"Where is this?" scattered across email threads',
  "No record of what was already approved",
  "Vendor and customs paperwork assembled by hand",
  "Principal has to ask for a status update",
];

export const COMPARE_AFTER = [
  "One work plan with every step and its owner",
  "Every approval logged with who signed off",
  "Customs and shipping paperwork pre-filled",
  "Principal sees live status in Client Portal",
];

export const COMPARE_DETAILS = {
  before: {
    label: "Without Whitby",
    text: "A relocation like the Zurich → Austin move typically takes a team member 9+ days to fully scope: chasing quotes, confirming dates by email, and manually tracking who approved what.",
  },
  after: {
    label: "With Whitby",
    text: "Whitby reads the request, drafts a six-week timeline with milestones, and routes only the sensitive steps — like a tax-residency change or a budget over threshold — for a person to approve. Typical time to a confirmed plan: under 2 days.",
  },
};

export const HERO_TRY_ASKING = [
  "Relocation",
  "Board packet",
  "Residence opening",
];

export const HERO_CHIP_PROMPTS: Record<string, string> = {
  Relocation: "Plan a Zurich → Austin relocation",
  "Board packet": "Draft a Q3 board packet",
  "Residence opening": "Open the Aspen residence for winter",
  Relocate: "Plan a relocation to Geneva for a family of four",
  "Plan an event": "Plan a private event for 40 guests next month",
  "Coordinate client work": "Organize a client project with multiple deadlines and approvals",
  "Manage family matters": "Prepare for a family meeting with advisers and key decisions",
};

export const ASSISTANT_SHORTCUTS = [
  { label: "Timeline", icon: "date", prompt: "Build a six-week relocation timeline" },
  { label: "Approvals", icon: "approved", prompt: "Which steps need human approval?" },
  { label: "Modules", icon: "whitby", prompt: "What does Whitby do?" },
] as const;

export const ASSISTANT_PROMPTS = [
  "Family relocation to Austin with school enrollment and tax residency checks",
  "Boutique board packet for a family office with agenda and shared docs",
  "Half-day residence opening plan with staffing and vendor prep",
];

export const PRINCIPLE_BAND = [
  {
    title: "Discreet by default",
    body: "Internal notes, workplans and provider research never reach the principal’s view.",
  },
  {
    title: "A person decides",
    body: "Whitby drafts and runs; anything sensitive waits for a named approver.",
  },
  {
    title: "Credentialed hands",
    body: "Every specialist holds the Certified Private Attaché credential before touching an engagement.",
  },
] as const;

export const COORDINATION_STEPS = [
  {
    n: "01",
    title: "Bring the idea",
    body: "Describe the request in plain language. No forms, no templates.",
    icon: "message" as const,
  },
  {
    n: "02",
    title: "Refine the plan",
    body: "Whitby drafts, you approve. Every sensitive step stops for a person.",
    icon: "approved" as const,
  },
  {
    n: "03",
    title: "Run it end to end",
    body: "Portal, Academy and Partner Center connect in. One identity, scoped per role.",
    icon: "whitby" as const,
  },
] as const;

export const VA_CHOICES = [
  {
    id: "maya",
    initials: "MR",
    name: "Maya R.",
    specialty: "Travel & Global Mobility",
    focus: "Builds the timeline, vendors, and residency checkpoints.",
    selected: true,
  },
  {
    id: "jordan",
    initials: "JK",
    name: "Jordan K.",
    specialty: "Family Office Operations",
    focus: "Owns board packets, entity calendars, and reporting cycles.",
    selected: false,
  },
  {
    id: "elena",
    initials: "ES",
    name: "Elena S.",
    specialty: "Private Residence Operations",
    focus: "Staffs openings, vendors, and seasonal residence cycles.",
    selected: false,
  },
] as const;

export const VA_CAPABILITIES = [
  {
    title: "Pick the right VA",
    body: "Match by specialty, credential, and availability — not a generic queue.",
  },
  {
    title: "Build the plan together",
    body: "Your VA refines Whitby’s draft with you until every step has an owner.",
  },
  {
    title: "Execute with checkpoints",
    body: "They run the routine work; anything sensitive still waits for your approval.",
  },
] as const;

export function chatReply(text: string) {
  const t = text.toLowerCase();
  if (t.includes("partner") || t.includes("referral") || t.includes("commission")) {
    return "Open Solutions → Referral partners, or Platform → Partner Center, for referrals, tracking, and commissions.";
  }
  if (t.includes("academy") || t.includes("certif") || t.includes("course")) {
    return "Academy is in the main nav — eight specialty endorsements, each needing learning, applied work, and an assessment.";
  }
  if (t.includes("portal") || t.includes("client")) {
    return "Open Solutions → Private Client Services or Personal & Family for the Client Portal view.";
  }
  if (t.includes("whitby") || t.includes("plan") || t.includes("draft")) {
    return "Whitby is under Platform — it drafts and runs the plan for any request. Try the hero search box.";
  }
  if (t.includes("va") || t.includes("virtual assistant") || t.includes("specialist")) {
    return "You choose a VA on each engagement — they build and execute the plan with Whitby. See Virtual assistants on this page, or Explore Whitby.";
  }
  if (t.includes("price") || t.includes("cost")) {
    return "Pricing is in the main nav — scope depends on the engagement; reach out for a tailored quote.";
  }
  if (t.includes("security")) {
    return "Security is under Resources — scroll the landing page or use Resources → Security.";
  }
  return "Browse Platform and Solutions in the main nav, or reach out from the footer and a coordinator will follow up.";
}
