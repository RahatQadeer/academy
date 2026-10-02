import type { ModuleKey } from "@/base/landing/content";

export type ModulePageContent = {
  key: ModuleKey;
  slug: string;
  title: string;
  eyebrow: string;
  headline: string;
  lede: string;
  steps: Array<{ title: string; body: string }>;
  capabilities: Array<{ title: string; body: string }>;
  forWhom: Array<{ title: string; body: string }>;
  outcome: string;
};

export const MODULE_SLUGS = [
  "whitby",
  "portal",
  "academy",
  "partner",
] as const;

export type ModuleSlug = (typeof MODULE_SLUGS)[number];

export const MODULE_PAGES: Record<ModuleSlug, ModulePageContent> = {
  whitby: {
    key: "whitby",
    slug: "whitby",
    title: "Whitby",
    eyebrow: "Module",
    headline: "Draft the plan. Run it with you.",
    lede:
      "Bring a relocation, a board packet, or a residence opening in plain language. Whitby drafts the work plan, flags what needs a person, and keeps the engagement moving.",
    steps: [
      {
        title: "Describe the request",
        body: "No forms or templates. Say what needs to happen, for whom, and by when.",
      },
      {
        title: "Review the draft plan",
        body: "Whitby matches a specialist track, sequences the work, and estimates the timeline.",
      },
      {
        title: "Approve what matters",
        body: "Sensitive steps stop for a named approver. Everything else can run.",
      },
      {
        title: "Keep the run moving",
        body: "Milestones update as work completes. The principal only sees what they should.",
      },
    ],
    capabilities: [
      {
        title: "Work plans from plain language",
        body: "Whitby turns a spoken or typed request into sequenced steps with owners and timing.",
      },
      {
        title: "Human checkpoints",
        body: "Budgets, filings, and anything sensitive wait for approval before they proceed.",
      },
      {
        title: "Live run view",
        body: "See what is done, what is waiting, and what runs next — without digging through threads.",
      },
    ],
    forWhom: [
      {
        title: "Specialists",
        body: "Draft beside Whitby, approve the sensitive steps, and stay in the run.",
      },
      {
        title: "Family offices",
        body: "One coordination layer across every engagement, with a clear audit of decisions.",
      },
    ],
    outcome:
      "A living plan you can trust — drafted quickly, gated by people, and connected to Portal, Academy, and Partner Center.",
  },
  portal: {
    key: "portal",
    slug: "portal",
    title: "Client Portal",
    eyebrow: "Module",
    headline: "What the principal sees — without the noise.",
    lede:
      "The Client Portal is a scoped view of status, shared documents, and next steps. Internal notes, workplans, and provider research never reach the principal.",
    steps: [
      {
        title: "Scope the engagement view",
        body: "Only shared status, documents, and actions the principal should take appear.",
      },
      {
        title: "Surface the next step",
        body: "Clear calls to action — confirm enrollment, review an agenda, acknowledge a date.",
      },
      {
        title: "Share documents intentionally",
        body: "Files enter the portal when someone decides they belong there. Nothing leaks by default.",
      },
      {
        title: "Keep internals internal",
        body: "Provider scoring, staffing plans, and specialist notes stay on the coordination side.",
      },
    ],
    capabilities: [
      {
        title: "Discreet by default",
        body: "The portal is a filtered surface, not a mirror of the full workplan.",
      },
      {
        title: "Action-needed clarity",
        body: "When something waits on the principal, it is labeled plainly — not buried in updates.",
      },
      {
        title: "Shared timeline",
        body: "Progress the principal should know, without the scaffolding behind it.",
      },
    ],
    forWhom: [
      {
        title: "Principals",
        body: "A calm view of what is happening and what is asked of them.",
      },
      {
        title: "Family offices",
        body: "Give principals visibility without exposing how the work is staffed and scored.",
      },
    ],
    outcome:
      "Trust without oversharing — the principal stays informed, and the coordination layer stays private.",
  },
  academy: {
    key: "academy",
    slug: "academy",
    title: "Academy",
    eyebrow: "Module",
    headline: "Credentialed hands before they touch an engagement.",
    lede:
      "Academy is how Private Attaché trains and endorses specialists. The Certified Private Attaché credential comes first; specialty endorsements unlock applied tracks.",
    steps: [
      {
        title: "Complete the CPA",
        body: "The foundational Certified Private Attaché credential — renewable through continuing coordination hours.",
      },
      {
        title: "Choose a specialty",
        body: "Residence operations, family office, travel, security, and more — each with learning and applied work.",
      },
      {
        title: "Pass the assessment",
        body: "Endorsements require demonstrated judgment, not just course completion.",
      },
      {
        title: "Stay current",
        body: "Continuing hours and renewals keep credentials active on live engagements.",
      },
    ],
    capabilities: [
      {
        title: "Certified Private Attaché",
        body: "The base credential every specialist holds before touching principal work.",
      },
      {
        title: "Specialty endorsements",
        body: "Eight applied tracks that unlock after the CPA, each with its own assessment.",
      },
      {
        title: "Progress you can trust",
        body: "Learning, applied work, and assessment status stay visible to the coordination team.",
      },
    ],
    forWhom: [
      {
        title: "Specialists",
        body: "Build the credential path that matches the engagements you want to run.",
      },
      {
        title: "Family offices",
        body: "Know that every hand on an engagement has passed the same bar.",
      },
    ],
    outcome:
      "A credentialed bench — so Whitby drafts beside people who are ready for the work.",
  },
  partner: {
    key: "partner",
    slug: "partner",
    title: "Partner Center",
    eyebrow: "Module",
    headline: "Refer once. Track to conversion. Get paid on schedule.",
    lede:
      "Partner Center is for referral partners who bring engagements in. Submit a referral, protect the relationship through the window, and follow commissions through conversion.",
    steps: [
      {
        title: "Submit the referral",
        body: "Capture the opportunity once — who, what, and the context Whitby needs to open a plan.",
      },
      {
        title: "Hold the protection window",
        body: "The relationship stays attributed through the agreed protection period.",
      },
      {
        title: "Track to conversion",
        body: "See status as the engagement moves from intro to active coordination.",
      },
      {
        title: "Receive commissions",
        body: "Converted referrals post on a fixed schedule at your program tier’s rate.",
      },
    ],
    capabilities: [
      {
        title: "Referral pipeline",
        body: "One place to submit, watch stages, and know what still needs a handoff.",
      },
      {
        title: "Protection windows",
        body: "Attribution rules that keep the originating partner credited fairly.",
      },
      {
        title: "Commission clarity",
        body: "Tier rates and first-year estimates you can show before you refer.",
      },
    ],
    forWhom: [
      {
        title: "Referral partners",
        body: "Advisors and introducers who want a clean path from intro to payout.",
      },
      {
        title: "Family offices",
        body: "Accept partnered introductions without losing the coordination trail.",
      },
    ],
    outcome:
      "A partner program that is legible — from first referral to scheduled commission.",
  },
};

export function isModuleSlug(value: string): value is ModuleSlug {
  return (MODULE_SLUGS as readonly string[]).includes(value);
}

export function moduleHref(key: ModuleKey): string {
  return `/modules/${key}`;
}
