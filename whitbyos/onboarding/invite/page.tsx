import { Button } from "@/base/components/Button";
import { Callout } from "@/base/components/Callout";
import { SessionExpired } from "@/base/components/SessionExpired";
import { Toast } from "@/whitbyos/components/Toast";
import { OnboardingShell } from "@/whitbyos/onboarding/components/OnboardingShell";
import { BackAction } from "@/whitbyos/onboarding/components/OnboardingButtons";
import { InviteRows } from "@/whitbyos/onboarding/invite/InviteRows";
import { InviteActions } from "@/whitbyos/onboarding/invite/InviteActions";
import { createTeamInvites } from "@/whitbyos/onboarding/actions";
import { getOnboardingWorkspace } from "@/whitbyos/lib/onboarding";
import { planFor, planLabel } from "@/whitbyos/lib/billing-vocab";
import { getCurrentWorkspacePlan } from "@/whitbyos/lib/workspace";
import { param, type SearchParams } from "@/whitbyos/lib/params";

const FOOTER_BTN =
  "rounded-[10px] px-5 py-[10px] text-[14px] font-semibold text-white shadow-[0_1px_0_rgba(255,255,255,.8)] hover:!text-white";

/** The role words the export uses, from the value stored on the invitation. */
function roleLabel(role?: string) {
  const words: Record<string, string> = {
    owner: "Owner",
    admin: "Admin",
    team_lead: "Team Lead",
    coordinator: "Coordinator",
    billing: "Billing",
    marketing: "Marketing",
    viewer: "Viewer",
  };
  return words[role ?? ""] ?? "a teammate";
}

export default async function InviteTeamPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const error = param(params, "error");
  const expired = param(params, "expired") === "1";
  // 4.6 — what was just sent, so the toast can name it.
  const sentTo = param(params, "sent");
  const sentRole = param(params, "role");
  const sentCount = Number(param(params, "count") ?? "1");

  // 4.35 — "Invite your team (Locked). Your Trial includes 1 user and no Team
  // Controls." A plan that includes one person has nobody to invite, so the
  // step is drawn and the form is not: being shown rows to type into and then
  // refused would be worse than being told up front.
  const planValue = await getCurrentWorkspacePlan();
  const plan = planFor(planValue);
  const teams = planFor("teams")!;
  const locked = (plan?.usersIncluded ?? 1) < 2;

  return (
    <form action={createTeamInvites}>
      <OnboardingShell
        step={5}
        width={680}
        lockHeight
        title={locked ? "Invite your team (Locked)" : "Invite your team"}
        subtitle={
          locked
            ? `Your ${planLabel(planValue)} includes ${plan?.usersIncluded ?? 1} user and no Team Controls. Upgrade to Teams to invite people now.`
            : "Optional. You can always invite teammates later from People & Access."
        }
        workspace={await getOnboardingWorkspace()}
        footer={
          <div className="flex items-center justify-between gap-3">
            <BackAction href="/onboarding/plan" />
            <div className="flex items-center gap-2.5">
              {locked ? (
                <Button href="/onboarding/ready" variant="primary" unsized className={FOOTER_BTN}>
                  Continue solo
                </Button>
              ) : (
                <InviteActions />
              )}
            </div>
          </div>
        }
      >
        {error ? <Callout tone="danger">{error}</Callout> : null}

        {locked ? (
          <LockedInvitePanel
            price={teams.price}
            users={teams.usersIncluded}
          />
        ) : (
          <InviteRows />
        )}

        {/* 4.4 — over this step, which is where the export draws it. */}
        {expired ? <SessionExpired next="/onboarding/invite" /> : null}

        {/* 4.6 — Invitation Sent, over this step rather than the next one. */}
        {sentTo ? (
          <Toast
            title={sentCount > 1 ? "Invitations sent" : "Invitation sent"}
            detail={
              sentCount > 1
                ? `${sentTo} and ${sentCount - 1} other${sentCount > 2 ? "s" : ""} will receive an email to join.`
                : `${sentTo} will receive an email to join as ${roleLabel(sentRole)}.`
            }
            closeHref="/onboarding/invite"
          />
        ) : null}
      </OnboardingShell>
    </form>
  );
}

function LockedInvitePanel({
  price,
  users,
}: {
  price: number | null;
  users: number | null;
}) {
  return (
    <div
      className="relative overflow-hidden rounded-[16px] px-5 pb-5 pt-[18px]"
      style={{
        background: "linear-gradient(180deg, var(--accent-tint) 0%, #ffffff 48%)",
        boxShadow:
          "inset 0 0 0 1.5px var(--accent), 0 14px 32px -22px rgba(35,131,226,.45)",
      }}
    >
      <span
        aria-hidden
        className="absolute inset-x-8 top-0 h-[3px] rounded-b-full"
        style={{ background: "var(--accent)" }}
      />

      <div className="mb-3 flex items-start justify-between gap-3">
        <div
          className="flex h-10 w-10 items-center justify-center rounded-[12px]"
          style={{ background: "#ffffff", boxShadow: "inset 0 0 0 1px var(--chrome-line)" }}
          aria-hidden
        >
          <LockGlyph />
        </div>
        <span
          className="shrink-0 rounded-full px-2 py-[3px] text-[10px] font-semibold leading-none"
          style={{ background: "var(--accent)", color: "#fff" }}
        >
          Teams plan
        </span>
      </div>

      <h2 className="text-[16px] font-semibold tracking-[-0.2px]">
        Invites open on Teams
      </h2>
      <p className="mt-1.5 text-[13.5px] leading-snug" style={{ color: "var(--text-secondary)" }}>
        Teams starts at ${price}/mo billed annually and includes {users} users, plus Team
        Controls so you can invite people into this workspace.
      </p>

      <div className="mt-4">
        <Button
          href="/onboarding/plan"
          variant="primary"
          unsized
          className="h-[42px] rounded-[11px] px-5 text-[13px] font-semibold text-white hover:!text-white"
          style={{ boxShadow: "0 12px 20px -12px rgba(35,131,226,.95)" }}
        >
          Upgrade to Teams
        </Button>
      </div>
    </div>
  );
}

function LockGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
      <rect
        x="3.5"
        y="8"
        width="11"
        height="7.5"
        rx="2"
        stroke="var(--accent)"
        strokeWidth="1.5"
      />
      <path
        d="M6 8V6.2A3 3 0 0 1 9 3.2 3 3 0 0 1 12 6.2V8"
        stroke="var(--accent)"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
