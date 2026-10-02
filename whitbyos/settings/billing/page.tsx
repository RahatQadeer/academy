import Link from "next/link";
import { Button } from "@/base/components/Button";
import { Callout } from "@/base/components/Callout";
import { Pill } from "@/base/components/Pill";
import { Toast } from "@/whitbyos/components/Toast";
import { SettingsShell } from "@/whitbyos/settings/components/SettingsShell";
import { DetailRow } from "@/whitbyos/settings/components/Fields";
import {
  BuyCreditsDialog,
  ChangePlanDialog,
  ManageSeatsDialog,
  PayoutAccountDialog,
} from "@/whitbyos/settings/components/BillingDialogs";
import { getBillingSummary } from "@/whitbyos/lib/settings";
import { manageBilling } from "@/whitbyos/settings/actions";
import { Submit } from "@/base/components/Submit";
import { Modal } from "@/whitbyos/components/Modal";
import {
  INACTIVE_NOTE,
  NOT_CONNECTED,
  PLANS,
  SELLABLE,
  isInactive,
  planLabel,
  storageLabel,
  type Plan,
} from "@/whitbyos/lib/billing-vocab";

const BILLING = "/whitbyos/settings/billing";

/** Stripe's own status words, said the way 17.4 says things. */
function statusLabel(status: string | null) {
  if (!status) return "Unknown";
  const words: Record<string, string> = {
    trialing: "On trial",
    active: "Active",
    past_due: "Past due",
    unpaid: "Unpaid",
    canceled: "Cancelled",
    incomplete: "Incomplete",
    incomplete_expired: "Expired",
    paused: "Paused",
  };
  return words[status] ?? status;
}

function statusTone(status: string | null) {
  if (status === "active") return "success" as const;
  if (status === "trialing") return "info" as const;
  if (status === "past_due" || status === "unpaid") return "danger" as const;
  return "neutral" as const;
}

/** "21 September 2026", which is how the export dates a billing cycle. */
function longDate(value: string) {
  return new Date(value).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/** 17.4's card lines. A locked one is drawn rather than dropped. */
function planFeatures(plan: Plan): { on: boolean; label: string }[] {
  if (plan.billing === "custom") {
    return [
      { on: true, label: "Custom users" },
      { on: true, label: "Custom limits" },
      { on: true, label: "Custom AI usage" },
      { on: true, label: "Team Controls included" },
      { on: true, label: "Client Portal included" },
    ];
  }

  const users = plan.usersIncluded ?? 1;
  const teams = plan.value === "teams";

  return [
    { on: true, label: `${users} user${users === 1 ? "" : "s"}${teams ? " included" : ""}` },
    { on: true, label: `${plan.activeWorkspaces} active workspaces` },
    {
      on: true,
      label: `${plan.relationshipRecords?.toLocaleString()} records · ${storageLabel(plan.knowledgeMb)}`,
    },
    {
      on: true,
      label:
        plan.value === "professional"
          ? "Higher AI usage · Certified Learning Pathway"
          : plan.value === "standard"
            ? "AI usage included"
            : "Higher pooled AI usage",
    },
    teams
      ? { on: true, label: "Team Controls included" }
      : { on: false, label: "No Team Controls" },
    plan.clientPortal
      ? { on: true, label: "Client Portal included" }
      : { on: false, label: "No Client Portal" },
  ];
}

function one(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Screen 17.4 — Billing & Plan, with 17.4a–d over it.
 *
 * The export fills every figure in: Professional — Team, renewing Jul 1 2027,
 * 6 of 8 seats, 6,200 of 10,000 credits. All of it belongs to Stripe (§11.1.5),
 * which is connected in no environment — so the rows are drawn in their order
 * and each says where its answer comes from rather than showing a number
 * nobody can stand behind, on the one screen where somebody might act on it.
 *
 * Seats are the exception and are real: that is a count of this workspace's own
 * members, which Whitby knows without asking anyone.
 */
export default async function BillingSettingsPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const billing = await getBillingSummary();
  const currentPlan = PLANS.find((plan) => plan.value === billing.plan);

  const buying = one(searchParams?.credits) === "1";
  const changing = one(searchParams?.plan);
  const payout = one(searchParams?.payout) === "1";
  const seats = one(searchParams?.seats) === "1";
  const history = one(searchParams?.history) === "1";
  const blocked = one(searchParams?.blocked);
  const error = one(searchParams?.error);
  // Where Stripe sends people back to. "done" only means they finished at
  // Stripe; the subscription itself arrives on the webhook a moment later,
  // which is why this says checkout rather than claiming the plan has changed.
  const checkout = one(searchParams?.checkout);
  // A plan changed on an existing subscription never goes to Stripe, so it
  // comes back here rather than through `?checkout=`.
  const changed = one(searchParams?.changed);

  const pending = (
    <span className="text-[13.5px]" style={{ color: "var(--text-disabled)" }}>
      Not connected
    </span>
  );

  return (
    <SettingsShell active="billing" title="Billing & Plan" width={680}>
      {/* Said before anything else on the screen, because it changes what
          every line below it means. */}
      {isInactive(billing.plan) ? (
        <div className="mb-5">
          <Callout tone="warning" title="This workspace is inactive">
            {INACTIVE_NOTE}
          </Callout>
        </div>
      ) : null}

      <h2 className="mb-2.5 text-[14px] font-semibold">Subscription</h2>
      <div className="overflow-hidden rounded-[8px] border border-line">
        {/* These read from Stripe now, where there is a subscription to read.
            Each still says "not connected" on its own rather than as a block,
            because a workspace on the trial genuinely has none of them. */}
        <DetailRow label="Subscription plan">
          {billing.hasSubscription || isInactive(billing.plan) ? (
            <span className="text-[13.5px]">{planLabel(billing.plan)}</span>
          ) : (
            pending
          )}
        </DetailRow>
        <DetailRow label="Status">
          <Pill tone={statusTone(billing.status)}>{statusLabel(billing.status)}</Pill>
        </DetailRow>
        <DetailRow label="Start date">
          {billing.startedAt ? (
            <span className="text-[13.5px]">{longDate(billing.startedAt)}</span>
          ) : (
            pending
          )}
        </DetailRow>
        <DetailRow label={billing.status === "trialing" ? "Trial ends" : "Renewal date"}>
          {billing.status === "trialing" && billing.trialEndsAt ? (
            <span className="text-[13.5px]">{longDate(billing.trialEndsAt)}</span>
          ) : billing.renewsAt ? (
            <span className="text-[13.5px]">
              {longDate(billing.renewsAt)}
              {billing.cancelling ? ", then it ends" : ""}
            </span>
          ) : (
            pending
          )}
        </DetailRow>
        <DetailRow label="Last successful payment">
          {billing.hasSubscription ? (
            <span className="text-[13.5px]" style={{ color: "var(--text-secondary)" }}>
              Every invoice is kept in Stripe
            </span>
          ) : (
            pending
          )}
        </DetailRow>
        <DetailRow label="Failed payment / action required">
          {billing.status === "past_due" || billing.status === "unpaid" ? (
            <Pill tone="danger">Payment needs attention</Pill>
          ) : billing.hasSubscription ? (
            <span className="text-[13.5px]" style={{ color: "var(--text-secondary)" }}>
              None
            </span>
          ) : (
            pending
          )}
        </DetailRow>
        <DetailRow label="Included Users and AI allowance">
          <span className="text-[13.5px]">
            {billing.seatsUsed} {billing.seatsUsed === 1 ? "seat" : "seats"} in use
            <span style={{ color: "var(--text-disabled)" }}> · allowance not connected</span>
          </span>
        </DetailRow>
        <DetailRow label="Institute (Academy) & product entitlements" last>
          {pending}
        </DetailRow>
      </div>

      {/* "Seats" in the export, users in the pricing document — and they are
          not the same thing. A plan includes its users and prices no further
          one, so there is no per-seat rate to print here. */}
      {/* 17.4's own words, which are the pricing document's model and not the
          per-seat one the rest of the export still shows: "1 of 1 user ·
          Professional plan", and to get more you upgrade. */}
      <Section title="Seats">
        <div className="mb-2.5 flex items-center justify-between gap-3">
          <span className="text-[13.5px]">
            {billing.seatsUsed} of {currentPlan?.usersIncluded ?? 1} user
            {(currentPlan?.usersIncluded ?? 1) === 1 ? "" : "s"} ·{" "}
            {planLabel(billing.plan)} plan
          </span>
          <Link
            href={`${BILLING}?plan=teams`}
            className="text-[13px] font-medium no-underline"
            style={{ color: "var(--accent)" }}
          >
            Upgrade to Teams for more users
          </Link>
        </div>
        <p className="text-[12px]" style={{ color: "var(--text-tertiary)" }}>
          Standard and Professional plans include 1 user. Teams includes 3 users
          and adds Team Controls.
        </p>
      </Section>

      <Section title="AI Credits">
        <div className="mb-2.5 flex items-center justify-between gap-3">
          <span className="text-[13.5px]" style={{ color: "var(--text-disabled)" }}>
            Balance not connected
          </span>
          <Link
            href={`${BILLING}?credits=1`}
            className="text-[13px] font-medium no-underline"
            style={{ color: "var(--accent)" }}
          >
            Buy more credits
          </Link>
        </div>
        {/* Not "they reset each cycle" any more. Credits follow what the
            drafting actually costs us, billed each cycle with a markup on top;
            no plan carries a fixed allowance, so nothing resets to a number. */}
        <p className="text-[12px]" style={{ color: "var(--text-tertiary)" }}>
          Credits meter Whitby&apos;s drafting and generation, Work Plans,
          Playbooks, updates. They are billed by cycle against what that
          generation costs. No per-plan allowance is set yet.
        </p>
      </Section>

      <Section title="Payout Account">
        <div className="mb-2.5 flex items-center justify-between gap-3">
          <span className="text-[13.5px]" style={{ color: "var(--text-disabled)" }}>
            No account connected
          </span>
          <Link
            href={`${BILLING}?payout=1`}
            className="text-[13px] font-medium no-underline"
            style={{ color: "var(--accent)" }}
          >
            Manage payout account
          </Link>
        </div>
        <p className="text-[12px]" style={{ color: "var(--text-tertiary)" }}>
          Client payments deposit directly to your own account. Private Attaché
          never holds or routes client funds.
        </p>
      </Section>

      {/* 17.4 draws the plans as cards with what each includes and one action
          apiece (Downgrade below the current one, Upgrade above it) with the
          billing history link on the section's own line.

          Every figure comes from `billing-vocab`, which is the pricing
          document. The reference's own cards agree with it; where the rest of
          this screen still says $89/seat or $18/seat, the document wins. */}
      <Section
        title="Plans"
        aside={
          <Link
            href={`${BILLING}?history=1`}
            className="text-[13px] font-medium no-underline"
            style={{ color: "var(--accent)" }}
          >
            View billing history
          </Link>
        }
      >
        <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(210px,1fr))]">
          {SELLABLE.map((plan) => {
            const current = plan.value === billing.plan;
            const rank = PLANS.findIndex((row) => row.value === plan.value);
            const currentRank = PLANS.findIndex((row) => row.value === billing.plan);

            return (
              <div
                key={plan.value}
                className="flex flex-col gap-2.5 rounded-card p-4"
                style={{
                  border: `1px solid ${current ? "var(--accent)" : "var(--border)"}`,
                  background: current ? "var(--accent-tint)" : "var(--surface)",
                }}
              >
                <span className="text-[14px] font-semibold">{plan.label}</span>

                <span>
                  <span className="text-[20px] font-bold">
                    {plan.billing === "custom" ? "Custom" : `$${plan.price}`}
                  </span>
                  <span className="text-[12.5px]" style={{ color: "var(--text-tertiary)" }}>
                    {plan.billing === "custom"
                      ? " annual or multi-year"
                      : plan.billing === "annual"
                        ? " /mo, billed annually"
                        : " /mo"}
                  </span>
                </span>

                <ul className="flex flex-col gap-1 text-[12.5px]">
                  {planFeatures(plan).map((feature) => (
                    <li
                      key={feature.label}
                      className="flex gap-1.5"
                      style={{ color: feature.on ? "var(--ink)" : "var(--text-quiet)" }}
                    >
                      <span aria-hidden>{feature.on ? "·" : "\u{1F512}"}</span>
                      {feature.label}
                    </li>
                  ))}
                </ul>

                <div className="mt-auto pt-1">
                  {current ? (
                    <span
                      className="block rounded-control px-3 py-1.5 text-center text-[12.5px] font-medium"
                      style={{ border: "1px solid var(--border)", color: "var(--text-tertiary)" }}
                    >
                      Current plan
                    </span>
                  ) : (
                    <Link
                      href={`${BILLING}?plan=${plan.value}`}
                      className="block rounded-control border border-line-strong px-3 py-1.5 text-center text-[12.5px] font-medium no-underline"
                      style={{ background: "var(--surface)", color: "var(--ink)" }}
                    >
                      {plan.value === "enterprise"
                        ? "Talk to us"
                        : rank < currentRank
                          ? "Downgrade"
                          : "Upgrade"}
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Section>

      {/* Stripe hosts the card, the invoices and the cancellation, so this is
          a door to it rather than a screen of our own. Only where there is a
          subscription for it to open. */}
      <div className="mt-6 flex flex-wrap items-center gap-2.5">
        {billing.connected && billing.hasSubscription ? (
          <form action={manageBilling}>
            <Submit unsized variant="secondary" className="px-4 py-[9px] text-[13.5px]">
              Manage billing in Stripe
            </Submit>
          </form>
        ) : null}
        <Button unsized href="/whitbyos/integrations" variant="secondary" className="px-4 py-[9px] text-[13.5px]">
          Go to Integrations
        </Button>
      </div>

      {/* 17.4 puts this on the Plans heading. There is no history to show while
          billing is connected nowhere, so it says so rather than opening an
          empty page, or, as it did a moment ago, nothing at all. */}
      {history ? (
        <Modal title="Billing history" closeHref={BILLING} width={440} dense>
          <p
            className="-mt-2 text-[13.5px] leading-[1.6]"
            style={{ color: "var(--text-secondary)" }}
          >
            {billing.hasSubscription
              ? "Every invoice for this workspace lives in Stripe, which sends them by email and keeps them downloadable. Whitby does not copy them."
              : NOT_CONNECTED}
          </p>
          <div className="mt-5 flex justify-end gap-2.5">
            {billing.hasSubscription ? (
              <form action={manageBilling}>
                <Submit unsized variant="primary" className="px-[18px] py-[9px] text-[13.5px]">
                  Open in Stripe
                </Submit>
              </form>
            ) : null}
            <Button unsized href={BILLING} variant="secondary" className="px-4 py-[9px] text-[13.5px]">
              Close
            </Button>
          </div>
        </Modal>
      ) : null}

      {buying ? <BuyCreditsDialog error={error} /> : null}

      {changing ? (
        <ChangePlanDialog
          current={billing.plan}
          target={changing}
          seats={billing.seatsUsed}
          trialing={billing.status === "trialing"}
          error={error}
        />
      ) : null}

      {payout ? <PayoutAccountDialog /> : null}

      {seats ? (
        <ManageSeatsDialog
          team={billing.team}
          seatsUsed={billing.seatsUsed}
          seatLimit={currentPlan?.usersIncluded ?? null}
        />
      ) : null}

      {changed ? (
        <Toast
          title={`Now on ${PLANS.find((plan) => plan.value === changed)?.label ?? changed}`}
          detail={
            billing.status === "trialing"
              ? "Your subscription moved to the new plan. The trial you are on is unchanged, and nothing was charged."
              : "Your subscription moved to the new plan. Stripe works out the difference for the rest of this cycle."
          }
          closeHref={BILLING}
        />
      ) : null}

      {checkout === "done" ? (
        <Toast
          title="Stripe has your payment"
          detail="The plan updates here as soon as Stripe confirms the subscription, usually within a few seconds."
          closeHref={BILLING}
        />
      ) : null}

      {checkout === "cancelled" ? (
        <Toast
          tone="warning"
          title="Nothing was charged"
          detail="You left Stripe before finishing, so the plan is unchanged."
          closeHref={BILLING}
        />
      ) : null}

      {blocked ? (
        <Toast
          tone="warning"
          title="Nothing was charged"
          detail={blocked}
          closeHref={BILLING}
          action={
            <Button unsized
              href="/whitbyos/integrations"
              variant="secondary"
              className="px-3 py-1.5 text-[12.5px]"
            >
              Go to Integrations
            </Button>
          }
        />
      ) : null}
    </SettingsShell>
  );
}

function Section({
  title,
  aside,
  children,
}: {
  title: string;
  /** 17.4 puts "View billing history" on the Plans heading's own line. */
  aside?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <>
      <div className="mb-2.5 mt-7 flex items-center justify-between gap-3">
        <h2 className="text-[14px] font-semibold">{title}</h2>
        {aside}
      </div>
      <div className="rounded-[8px] border border-line px-5 py-4">{children}</div>
    </>
  );
}
