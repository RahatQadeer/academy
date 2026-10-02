import { Button } from "@/base/components/Button";
import { Submit } from "@/base/components/Submit";
import { Callout } from "@/base/components/Callout";
import { Modal } from "@/whitbyos/components/Modal";
import { CONTROL, CONTROL_UNSIZED, Field } from "@/whitbyos/components/Field";
import { saveWorkPlan } from "@/whitbyos/work-plans/actions";
import type { WorkPlanDetail } from "@/whitbyos/lib/work-plans";

const URGENCY = [
  { value: "critical", label: "Critical" },
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];

const HEALTH = [
  { value: "on_track", label: "On Track" },
  { value: "needs_attention", label: "Needs Attention" },
  { value: "at_risk", label: "At Risk" },
];

/**
 * Behind WP.17's Edit button and the ✎ beside the title.
 *
 * The reference draws both controls without a screen behind them, so this
 * follows WP.19's shape — the design's own vocabulary for editing one object in
 * a plan — rather than inventing a different one.
 */
export function EditPlanDialog({
  plan,
  closeHref,
  error,
}: {
  plan: WorkPlanDetail;
  closeHref: string;
  error?: string;
}) {
  return (
    <Modal title="Edit Work Plan" closeHref={closeHref} width={520}>
      <form action={saveWorkPlan} className="flex flex-col gap-4">
        <input type="hidden" name="plan_id" value={plan.id} />

        {error ? <Callout tone="danger">{error}</Callout> : null}

        <Field label="Name" htmlFor="name">
          <input id="name" name="name" required defaultValue={plan.name} className={CONTROL} />
        </Field>

        <Field label="Desired Outcome" htmlFor="desired_outcome">
          <textarea
            id="desired_outcome"
            name="desired_outcome"
            rows={3}
            defaultValue={plan.desired_outcome ?? ""}
            placeholder="What does done look like for this plan?"
            className={`${CONTROL} resize-y`}
          />
        </Field>

        <div className="flex gap-3">
          <Field label="Urgency" htmlFor="urgency" className="flex-1">
            <select
              id="urgency"
              name="urgency"
              defaultValue={plan.urgency}
              className={`${CONTROL_UNSIZED} text-[13.5px]`}
            >
              {URGENCY.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Health" htmlFor="health" className="flex-1">
            <select
              id="health"
              name="health"
              defaultValue={plan.health}
              className={`${CONTROL_UNSIZED} text-[13.5px]`}
            >
              {HEALTH.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <div className="flex gap-3">
          {/* The Report Timeline begins a stream's bar where its plan begins —
              the only start either of them records. Nothing could set it
              before, so every bar started at the left edge of the report's
              period whether the work did or not. */}
          <Field label="Start Date" htmlFor="start_date" className="flex-1">
            <input
              id="start_date"
              name="start_date"
              type="date"
              defaultValue={plan.start_date ? plan.start_date.slice(0, 10) : ""}
              className={`${CONTROL_UNSIZED} text-[13.5px]`}
            />
          </Field>

          <Field label="Target Date" htmlFor="target_date" className="flex-1">
            <input
              id="target_date"
              name="target_date"
              type="date"
              defaultValue={plan.target_date ? plan.target_date.slice(0, 10) : ""}
              className={`${CONTROL_UNSIZED} text-[13.5px]`}
            />
          </Field>
        </div>

        <p className="text-[12px]" style={{ color: "var(--text-tertiary)" }}>
          Status is not edited here, a plan becomes active when it is adopted,
          and complete when its Request closes.
        </p>

        <div className="mt-1 flex justify-end gap-2.5">
          <Button unsized href={closeHref} variant="secondary" className="px-4 py-[9px] text-[13.5px]">
            Cancel
          </Button>
          <Submit unsized variant="primary" className="px-[18px] py-[9px] text-[13.5px]">
            Save
          </Submit>
        </div>
      </form>
    </Modal>
  );
}
