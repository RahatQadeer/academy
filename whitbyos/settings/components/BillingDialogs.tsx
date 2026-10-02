import Link from "next/link";
import { Button } from "@/base/components/Button";
import { Submit, SubmitPlain } from "@/base/components/Submit";
import { Callout } from "@/base/components/Callout";
import { Modal } from "@/whitbyos/components/Modal";
import { DialogForm } from "@/whitbyos/components/DialogForm";
import { buyCredits, changePlan } from "@/whitbyos/settings/actions";
import { CREDIT_PACKS, PLANS, planPrice } from "@/whitbyos/lib/billing-vocab";

const BILLING = "/whitbyos/settings/billing";

/** Screen 17.4a — Buy AI Credits. */
export function BuyCreditsDialog({ error }: { error?: string }) {
  return (
    <Modal title="Buy AI Credits" closeHref={BILLING} width={440} dense>
      <p className="-mt-2 mb-4 text-[13px]" style={{ color: "var(--text-secondary)" }}>
        Add credits to this cycle&apos;s balance. Credits are billed by cycle
        against what generation costs; no per-plan allowance is set yet.
      </p>

      {error ? (
        <div className="mb-4">
          <Callout tone="danger">{error}</Callout>
        </div>
      ) : null}

      <form action={buyCredits} className="flex flex-col gap-2">
        {CREDIT_PACKS.map((pack) => (
          <SubmitPlain
            key={pack.credits}
           
            name="credits"
            value={pack.credits}
            className="flex items-center justify-between rounded-[8px] border border-line-strong px-4 py-3 text-left hover:bg-[var(--surface-soft)]"
          >
            <span className="text-[13.5px] font-medium">
              {pack.credits.toLocaleString()} credits
            </span>
            <span className="text-[13.5px]" style={{ color: "var(--text-secondary)" }}>
              {pack.price}
            </span>
          </SubmitPlain>
        ))}

        <div className="mt-3 flex justify-end">
          <Link
            href={BILLING}
            className="rounded-control border border-line-strong px-4 py-[9px] text-[13.5px] font-medium no-underline"
            style={{ color: "var(--ink)" }}
          >
            Cancel
          </Link>
        </div>
      </form>
    </Modal>
  );
}

/** Screen 17.4b — Confirm plan change. */
export function ChangePlanDialog({
  current,
  target,
  seats,
  trialing = false,
  error,
}: {
  current: string;
  target: string;
  seats: number;
  /** A trial has not been billed, so a plan change costs nothing yet. */
  trialing?: boolean;
  error?: string;
}) {
  const from = PLANS.find((plan) => plan.value === current) ?? PLANS[0]!;
  const to = PLANS.find((plan) => plan.value === target) ?? PLANS[1]!;

  return (
    <Modal title="Confirm plan change" closeHref={BILLING} width={440} dense>
      {error ? (
        <div className="mb-4">
          <Callout tone="danger">{error}</Callout>
        </div>
      ) : null}

      {/* No arithmetic across the two prices any more. A plan includes its
          users rather than charging for them, so there is no seat count to
          multiply, and Enterprise is quoted by hand, so one side of that sum
          may have no number at all. */}
      <p className="-mt-2 mb-5 text-[13.5px] leading-[1.7]" style={{ color: "var(--text-secondary)" }}>
        You&apos;re changing from{" "}
        <strong style={{ color: "var(--ink)" }}>
          {from.label} ({planPrice(from)})
        </strong>{" "}
        to{" "}
        <strong style={{ color: "var(--ink)" }}>
          {to.label} ({planPrice(to)})
        </strong>
        .{" "}
        {to.usersIncluded
          ? `${to.label} includes ${to.usersIncluded} user${to.usersIncluded === 1 ? "" : "s"}; this workspace has ${seats} in it.`
          : null}
      </p>

      {/* The export shows a prorated figure. Stripe owns the cycle dates and the
          credit rules, so the number is theirs to work out; printing one here
          would put a figure in front of someone that no invoice will match. */}
      <p className="mb-5 text-[12.5px]" style={{ color: "var(--text-tertiary)" }}>
        {trialing
          ? "Your subscription moves to this plan and the trial you are on carries over. Nothing is charged while the trial runs."
          : "Your subscription moves to this plan. Stripe works out the difference for the rest of this cycle."}
      </p>

      <DialogForm
        action={changePlan}
        closeHref={BILLING}
        submitLabel="Confirm change"
        pendingLabel="Changing…"
      >
        <input type="hidden" name="plan" value={target} />
      </DialogForm>
    </Modal>
  );
}

/**
 * Screen 17.4c — Payout account.
 *
 * The only one of the four the export itself says is not simulated: "Private
 * Attaché never holds or routes client funds — updating bank details hands off
 * to Stripe's own verification flow, not simulated here."
 */
export function PayoutAccountDialog() {
  return (
    <Modal title="Payout account" closeHref={BILLING} width={460} dense>
      <div
        className="-mt-2 mb-4 flex items-center gap-3 rounded-[8px] px-4 py-3.5"
        style={{ background: "var(--surface-soft)" }}
      >
        <span className="text-[18px]" aria-hidden>
          🏦
        </span>
        <div className="min-w-0">
          <div className="text-[13.5px] font-medium">No account connected</div>
          <div className="text-[12.5px]" style={{ color: "var(--text-tertiary)" }}>
            Client payments have nowhere to be deposited yet
          </div>
        </div>
      </div>

      <p className="mb-5 text-[12.5px] leading-[1.7]" style={{ color: "var(--text-secondary)" }}>
        Client payments deposit directly to your own account. Private Attaché
        never holds or routes client funds, connecting or changing bank details
        hands off to the payment provider&apos;s own verification, which is not
        connected in this environment.
      </p>

      <div className="flex justify-end gap-2.5">
        <Link
          href={BILLING}
          className="rounded-control border border-line-strong px-4 py-[9px] text-[13.5px] font-medium no-underline"
          style={{ color: "var(--ink)" }}
        >
          Close
        </Link>
        <Button unsized
          href="/whitbyos/integrations"
          variant="primary"
          className="px-4 py-[9px] text-[13.5px]"
        >
          Go to Integrations
        </Button>
      </div>
    </Modal>
  );
}

/** Screen 17.4d — Manage seats. */
export function ManageSeatsDialog({
  team,
  seatsUsed,
  seatLimit,
}: {
  team: { name: string; roleLabel: string }[];
  seatsUsed: number;
  seatLimit: number | null;
}) {
  return (
    <Modal title="Manage seats" closeHref={BILLING} width={440} dense>
      <p className="-mt-2 mb-4 text-[13px]" style={{ color: "var(--text-secondary)" }}>
        {seatsUsed} of {seatLimit ?? seatsUsed} user{(seatLimit ?? seatsUsed) === 1 ? "" : "s"}{" "}
        included on your plan. Users come with the plan rather than being charged
        for, and no further one is priced.
      </p>

      <div className="mb-4 flex flex-col">
        {team.slice(0, 4).map((person, index) => (
          <div
            key={`${person.name}-${index}`}
            className="flex items-center justify-between gap-3 border-t border-line py-2.5 text-[13.5px] first:border-t-0 first:pt-0"
          >
            <span className="min-w-0 truncate">{person.name}</span>
            <span className="shrink-0 text-[12.5px]" style={{ color: "var(--text-tertiary)" }}>
              {person.roleLabel}
            </span>
          </div>
        ))}

        {team.length > 4 ? (
          <div className="border-t border-line pt-2.5 text-[12.5px]" style={{ color: "var(--text-tertiary)" }}>
            + {team.length - 4} more teammate{team.length - 4 === 1 ? "" : "s"}
          </div>
        ) : null}
      </div>

      {/* The export has an "+ Add seat · $18/mo" button. A seat is not bought
          on its own — it is what inviting somebody costs — so this points at the
          act that actually adds one rather than charging for an empty chair. */}
      <p className="mb-4 text-[12.5px]" style={{ color: "var(--text-tertiary)" }}>
        A seat is added by inviting someone on Team &amp; Access. It appears on
        the next invoice once billing is connected.
      </p>

      <div className="flex justify-end gap-2.5">
        <Link
          href={BILLING}
          className="rounded-control border border-line-strong px-4 py-[9px] text-[13.5px] font-medium no-underline"
          style={{ color: "var(--ink)" }}
        >
          Close
        </Link>
        <Button unsized
          href="/whitbyos/settings/team?invite=1"
          variant="primary"
          className="px-4 py-[9px] text-[13.5px]"
        >
          Invite a teammate
        </Button>
      </div>
    </Modal>
  );
}
