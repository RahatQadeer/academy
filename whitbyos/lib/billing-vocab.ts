/**
 * Billing vocabulary, kept clear of the server module for the modals.
 *
 * The numbers here come from `Pricing & Categories 8-25-26`, not from the Figma
 * export, because the two disagree and the document is what the plans are
 * actually sold at. The export drew two plans priced per seat — Professional at
 * $89 and Teams at $149 — and the document sells five plans with their users
 * included, Teams at $249. Building anything from the export would have been
 * $100 out on Teams and short by two whole plans.
 */

export type Plan = {
  value: string;
  label: string;
  /** The monthly figure the document prints. Null where it is quoted by hand. */
  price: number | null;
  /** How that figure is charged. Professional and Teams are billed annually. */
  billing: "free" | "monthly" | "annual" | "custom";
  /** Seats are not sold: each plan includes its users and no further one is priced. */
  usersIncluded: number | null;
  /** Archived Client Workspaces do not count toward this. */
  activeWorkspaces: number | null;
  relationshipRecords: number | null;
  knowledgeMb: number | null;
  /**
   * The words the pricing document uses — Limited, Included, Higher, Higher
   * pooled — and deliberately not a number. See AI_CREDITS_UNDEFINED.
   */
  aiUsage: string;
  /**
   * Whether this plan can invite clients into the Client Portal.
   *
   * The portal is not a fourth product professionals switch into. It is a
   * capability of the Whitby plan: Professional, Teams and Enterprise carry
   * it; Trial and Standard do not, and the switcher and settings say so
   * rather than drawing a nav item that goes nowhere.
   */
  clientPortal: boolean;
};

/** The five plans, in the order the document lists them. */
export const PLANS: Plan[] = [
  {
    value: "trial",
    label: "14-Day Free Trial",
    price: 0,
    billing: "free",
    usersIncluded: 1,
    activeWorkspaces: 2,
    relationshipRecords: 100,
    knowledgeMb: 250,
    aiUsage: "Limited",
    clientPortal: false,
  },
  {
    value: "standard",
    label: "Standard",
    price: 59,
    billing: "monthly",
    usersIncluded: 1,
    activeWorkspaces: 5,
    relationshipRecords: 1000,
    knowledgeMb: 1024,
    aiUsage: "Included",
    clientPortal: false,
  },
  {
    value: "professional",
    label: "Professional",
    price: 89,
    billing: "annual",
    usersIncluded: 1,
    activeWorkspaces: 25,
    relationshipRecords: 5000,
    knowledgeMb: 5120,
    aiUsage: "Higher",
    clientPortal: true,
  },
  {
    value: "teams",
    label: "Teams",
    price: 249,
    billing: "annual",
    usersIncluded: 3,
    activeWorkspaces: 100,
    relationshipRecords: 25000,
    knowledgeMb: 25600,
    aiUsage: "Higher pooled",
    clientPortal: true,
  },
  {
    value: "enterprise",
    label: "Enterprise",
    price: null,
    billing: "custom",
    usersIncluded: null,
    activeWorkspaces: null,
    relationshipRecords: null,
    knowledgeMb: null,
    aiUsage: "Custom",
    clientPortal: true,
  },
  {
    /**
     * Where a workspace lands when a paid subscription ends.
     *
     * Not Trial, which has been used and cannot be given again, and not the
     * plan they stopped paying for. Everything already made stays readable;
     * nothing new can be started until a plan is chosen. `null` on a limit
     * means unlimited, so these are zeros rather than nulls.
     */
    value: "inactive",
    label: "Inactive",
    price: null,
    billing: "custom",
    usersIncluded: 0,
    activeWorkspaces: 0,
    relationshipRecords: 0,
    knowledgeMb: 0,
    aiUsage: "None",
    clientPortal: false,
  },
];

/** The plans somebody can actually choose. Trial is entered, not bought; Inactive is fallen into. */
export const SELLABLE = PLANS.filter(
  (plan) => plan.value !== "trial" && plan.value !== "inactive",
);

/** Whether this workspace is shut out until it picks a plan. */
export function isInactive(plan: string | null) {
  return plan === "inactive";
}

export const INACTIVE_NOTE =
  "This workspace is inactive: the subscription has ended. Everything already here stays readable, and nothing new can be created until a plan is chosen.";

export const TRIAL_DAYS = 14;

/** How a plan's price reads on screen, in the document's own words. */
export function planPrice(plan: Plan) {
  if (plan.billing === "custom") return "Custom annual / multi-year";
  if (plan.billing === "free") return "Free";
  return plan.billing === "annual" ? `$${plan.price}/mo billed annually` : `$${plan.price}/mo`;
}

export function planLabel(value: string | null) {
  return PLANS.find((plan) => plan.value === value)?.label ?? "Standard";
}

export function planFor(value: string | null) {
  return PLANS.find((plan) => plan.value === value) ?? null;
}

/** Whether this Whitby plan can invite clients into the Client Portal. */
export function planIncludesClientPortal(value: string | null) {
  return planFor(value)?.clientPortal === true;
}

/** Storage as the document writes it — 250 MB, then whole gigabytes. */
export function storageLabel(mb: number | null) {
  if (mb === null) return "Custom";
  return mb < 1024 ? `${mb} MB` : `${mb / 1024} GB`;
}

/**
 * There is no per-plan AI credit allowance, and none should be written here.
 *
 * The client settled this on 2026-09-01, and the answer is that the question
 * had the wrong shape: credits are not a fixed monthly quantity per plan at
 * all. They follow our actual LLM/API cost, charged by billing cycle, with a
 * markup on top. The words in the pricing document, Limited through Higher
 * pooled, describe how much of that each plan is expected to carry, not an
 * allowance anybody has sized.
 *
 * **The markup rate is now decided.** On 2026-09-08 the client settled it: the
 * profit is half the cost, so cost 100 is charged at 150. It lives in
 * `whitbyos/lib/ai/cost.ts` and nowhere else, read from configuration so it can
 * move without a code change — it has already changed once, from an
 * illustration into a rate.
 *
 * **The allowance is still not decided**, and no number goes in this file for
 * Trial, Standard, Professional or Teams. A plausible-looking figure invented
 * to fill that gap would be charged to somebody. Nor is what a "credit" is
 * worth in cents; `cost.ts` deals in cents of real cost, which is the only
 * figure that is measured rather than derived.
 */
export const AI_CREDITS_UNDEFINED =
  "AI usage is billed from actual LLM cost plus a margin of half that cost, per cycle. No per-plan allowance is set.";

/**
 * 17.4a's three credit packs.
 *
 * Kept as the export draws them, and still unconfirmed — more so now. The
 * pricing document does not mention them, and a cost-plus-markup model billed
 * each cycle reads as usage measured after the fact rather than blocks bought
 * in advance. Whether these packs survive is a pricing decision; nothing here
 * charges anyone either way.
 */
export const CREDIT_PACKS = [
  { credits: 500, price: "$25" },
  { credits: 2500, price: "$99" },
  { credits: 10000, price: "$349" },
];

/**
 * Nothing in this module can charge anyone. Stripe is connected in no
 * environment (§11.1.5), and the export's own Payout Account panel says the
 * same about bank details: "not simulated here".
 *
 * So every one of these modals is built and every one of them stops at the
 * point money would move, rather than pretending. This is the sentence they
 * all say, in one place so they cannot drift apart.
 */
export const NOT_CONNECTED =
  "Billing is not connected, so nothing was charged and nothing changed. Connect a billing provider under Integrations first.";
