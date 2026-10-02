import { Button } from "@/base/components/Button";
import { Submit } from "@/base/components/Submit";
import { Callout } from "@/base/components/Callout";
import { Modal } from "@/whitbyos/components/Modal";
import { CONTROL, Field } from "@/whitbyos/components/Field";
import { updateRequest } from "@/whitbyos/requests/actions";
import { REQUEST_STATUSES, requestStatusValue } from "@/whitbyos/lib/request-status";

const URGENCIES = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "critical", label: "Critical" },
];

/**
 * Screen 3.3x — Edit Request.
 *
 * The five things about a Request that change after it is written down, and
 * the reason New Request now asks for four fields instead of seven: deciding
 * urgency, status and a date belongs to the moment somebody has read the
 * request, not the moment they are writing it.
 */
export function EditRequestDialog({
  requestId,
  closeHref,
  values,
  error,
}: {
  requestId: string;
  closeHref: string;
  values: {
    title: string;
    outcome: string | null;
    status: string | null;
    urgency: string | null;
    targetDate: string | null;
  };
  error?: string;
}) {
  return (
    <Modal title="Edit Request" closeHref={closeHref}>
      <form action={updateRequest} className="flex flex-col gap-[18px]">
        <input type="hidden" name="request_id" value={requestId} />

        {error ? <Callout tone="danger">{error}</Callout> : null}

        <Field label="Title" htmlFor="title">
          <input
            id="title"
            name="title"
            required
            defaultValue={values.title}
            className={CONTROL}
          />
        </Field>

        <Field label="Description" htmlFor="desired_outcome">
          <textarea
            id="desired_outcome"
            name="desired_outcome"
            rows={3}
            defaultValue={values.outcome ?? ""}
            className={`${CONTROL} resize-y`}
          />
        </Field>

        <Field label="Status" htmlFor="status">
          <select
            id="status"
            name="status"
            defaultValue={requestStatusValue(values.status)}
            className={CONTROL}
          >
            {REQUEST_STATUSES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Urgency" htmlFor="urgency">
          <select
            id="urgency"
            name="urgency"
            defaultValue={values.urgency ?? "medium"}
            className={CONTROL}
          >
            {URGENCIES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Due date" htmlFor="target_date">
          <input
            id="target_date"
            name="target_date"
            type="date"
            defaultValue={values.targetDate ?? ""}
            className={CONTROL}
          />
        </Field>

        <div className="mt-1 flex justify-end gap-2.5">
          <Button unsized href={closeHref} variant="secondary" className="px-4 py-[9px] text-[14px]">
            Cancel
          </Button>
          <Submit unsized variant="primary" className="px-[18px] py-[9px] text-[14px]">
            Save Changes
          </Submit>
        </div>
      </form>
    </Modal>
  );
}
