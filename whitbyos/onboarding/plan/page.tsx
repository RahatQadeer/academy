import { Submit } from "@/base/components/Submit";
import { OnboardingShell } from "@/whitbyos/onboarding/components/OnboardingShell";
import { BackAction } from "@/whitbyos/onboarding/components/OnboardingButtons";
import { selectPlan, continueFromPlan } from "@/whitbyos/onboarding/actions";
import { getOnboardingWorkspace } from "@/whitbyos/lib/onboarding";
import { PLANS, storageLabel, type Plan } from "@/whitbyos/lib/billing-vocab";
import { getCurrentWorkspacePlan } from "@/whitbyos/lib/workspace";

/**
 * What each plan carries, as 4.3 lists it, the same facts the pricing document
 * holds, written as the lines a card shows.
 *
 * Team Controls and the Learning Pathway are the two that can be absent, and an
 * absent one is drawn rather than omitted: "No Team Controls" tells somebody
 * comparing plans what they would be giving up, where a missing row tells them
 * nothing.
 */
function features(plan: Plan): { on: boolean; label: string }[] {
  if (plan.value === "enterprise") {
    return [
      { on: true, label: "Custom users" },
      { on: true, label: "Custom workspaces" },
      { on: true, label: "Custom records" },
      { on: true, label: "Custom AI usage" },
      { on: true, label: "Team Controls included" },
      { on: true, label: "Client Portal included" },
    ];
  }

  const users = plan.usersIncluded ?? 1;
  const teams = plan.value === "teams";

  return [
    { on: true, label: `${users} user${users === 1 ? "" : "s"}${teams ? " included" : ""}` },
    { on: true, label: `${plan.activeWorkspaces} workspaces` },
    { on: true, label: `${plan.relationshipRecords?.toLocaleString()} records` },
    { on: true, label: `${storageLabel(plan.knowledgeMb)} knowledge` },
    {
      on: true,
      label:
        plan.value === "standard"
          ? "AI usage included"
          : `${plan.aiUsage} AI usage`,
    },
    ...(plan.value === "professional" || teams
      ? [{ on: true, label: "Learning Pathway" }]
      : []),
    teams
      ? { on: true, label: "Team Controls included" }
      : { on: false, label: "No Team Controls" },
    plan.clientPortal
      ? { on: true, label: "Client Portal included" }
      : { on: false, label: "No Client Portal" },
  ];
}

function billingLine(plan: Plan) {
  if (plan.value === "trial") return "No card required";
  if (plan.billing === "custom") return "Annual or multi-year";
  return plan.billing === "annual" ? "Billed annually" : "Billed monthly";
}

/**
 * Screen 4.3, Onboarding Step 4/5, Choose your plan.
 *
 * Every figure on this screen comes from the pricing document by way of
 * `billing-vocab`, not from this file. The reference draws the same numbers,
 * which is how we know the two agree.
 *
 * Nothing here charges anyone. Billing is connected in no environment, so
 * choosing a plan records the choice and leaves the workspace on its trial,
 * and the screen says exactly that rather than implying a card was taken.
 */
export default async function PlanOnboardingPage() {
  const current = await getCurrentWorkspacePlan();

  return (
    <OnboardingShell
      step={4}
      width={1160}
      lockHeight
      title="Choose your plan"
      subtitle="You're starting on the 14-Day Free Trial. Pick a plan now, or continue on Trial and decide later from Settings → Billing & Plan."
      workspace={await getOnboardingWorkspace()}
      footer={
        <div className="flex items-center justify-between gap-3">
          <BackAction href="/onboarding/client-workspace" />
          <form action={continueFromPlan}>
            <input type="hidden" name="plan" value={current} />
            <Submit
              variant="secondary"
              unsized
              className="rounded-[10px] px-5 py-[10px] text-[14px] font-semibold shadow-[0_1px_0_rgba(255,255,255,.8)]"
            >
              Continue on Trial
            </Submit>
          </form>
        </div>
      }
    >
      <div className="grid min-h-0 min-w-0 flex-1 gap-3 [grid-template-columns:repeat(5,minmax(0,1fr))]">
        {PLANS.filter((plan) => plan.value !== "inactive").map((plan) => {
          const selected = plan.value === current;
          const popular = plan.value === "teams" && !selected;
          const name = plan.value === "trial" ? "Free Trial" : plan.label;

          return (
            <article
              key={plan.value}
              className="relative flex min-w-0 flex-col overflow-hidden rounded-[16px] px-4 pb-4 pt-[18px]"
              style={{
                background: selected
                  ? "linear-gradient(180deg, var(--accent-tint) 0%, #ffffff 48%)"
                  : "#ffffff",
                boxShadow: selected
                  ? "inset 0 0 0 1.5px var(--accent), 0 14px 32px -22px rgba(35,131,226,.45)"
                  : "inset 0 0 0 1px var(--chrome-line), 0 10px 24px -20px rgba(15,32,56,.22)",
              }}
            >
              {selected ? (
                <span
                  aria-hidden
                  className="absolute inset-x-6 top-0 h-[3px] rounded-b-full"
                  style={{ background: "var(--accent)" }}
                />
              ) : null}

              <div className="mb-3 flex items-start justify-between gap-2">
                <h2 className="min-w-0 text-[14px] font-semibold leading-tight tracking-[-0.2px]">
                  {name}
                </h2>
                {selected ? (
                  <span
                    className="shrink-0 rounded-full px-2 py-[3px] text-[10px] font-semibold leading-none"
                    style={{ background: "var(--accent)", color: "#fff" }}
                  >
                    Selected
                  </span>
                ) : popular ? (
                  <span
                    className="shrink-0 rounded-full px-2 py-[3px] text-[10px] font-semibold leading-none"
                    style={{ background: "var(--accent-tint)", color: "var(--accent)" }}
                  >
                    Popular
                  </span>
                ) : null}
              </div>

              <div className="mb-4">
                <div className="flex items-end gap-1">
                  <span className="text-[28px] font-bold leading-none tracking-[-0.7px]">
                    {plan.billing === "custom"
                      ? "Custom"
                      : plan.price === 0
                        ? "Free"
                        : `$${plan.price}`}
                  </span>
                  {plan.price && plan.billing !== "custom" ? (
                    <span className="pb-[2px] text-[13px]" style={{ color: "var(--text-tertiary)" }}>
                      /mo
                    </span>
                  ) : null}
                </div>
                <p className="mt-2 text-[12.5px]" style={{ color: "var(--text-tertiary)" }}>
                  {billingLine(plan)}
                </p>
              </div>

              <ul className="mb-5 flex flex-col gap-2.5">
                {features(plan).map((feature) => (
                  <li
                    key={feature.label}
                    className="flex min-w-0 items-start gap-2.5 text-[12.5px] leading-[1.4]"
                    style={{ color: feature.on ? "var(--ink)" : "var(--text-quiet)" }}
                  >
                    <Mark on={feature.on} />
                    <span className="min-w-0">{feature.label}</span>
                  </li>
                ))}
              </ul>

              {selected ? (
                <div
                  className="mt-auto flex h-[42px] shrink-0 items-center justify-center rounded-[11px] text-[13px] font-semibold text-white"
                  style={{
                    background: "var(--accent)",
                    boxShadow: "0 12px 20px -12px rgba(35,131,226,.95)",
                  }}
                >
                  Current plan
                </div>
              ) : (
                <form action={selectPlan} className="mt-auto shrink-0">
                  <input type="hidden" name="plan" value={plan.value} />
                  <Submit
                    variant="secondary"
                    fullWidth
                    unsized
                    className="h-[42px] overflow-hidden whitespace-nowrap rounded-[11px] px-2 text-[13px] font-semibold"
                  >
                    {plan.value === "enterprise" ? "Talk to us" : `Choose ${name}`}
                  </Submit>
                </form>
              )}
            </article>
          );
        })}
      </div>
    </OnboardingShell>
  );
}

function Mark({ on }: { on: boolean }) {
  return (
    <span
      aria-hidden
      className="mt-[1px] flex h-[16px] w-[16px] shrink-0 items-center justify-center rounded-full text-[9px] font-bold"
      style={
        on
          ? { background: "var(--success-bg, #e1f5ea)", color: "var(--success-fg)" }
          : { background: "var(--canvas)", color: "var(--text-quiet)" }
      }
    >
      {on ? "✓" : "·"}
    </span>
  );
}
