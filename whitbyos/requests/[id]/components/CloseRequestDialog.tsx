import { Button } from "@/base/components/Button";
import { Submit } from "@/base/components/Submit";
import { Callout } from "@/base/components/Callout";
import { Modal } from "@/whitbyos/components/Modal";
import { CONTROL, Field } from "@/whitbyos/components/Field";
import { closeRequest } from "@/whitbyos/requests/actions";

/**
 * SRS §6.16.4's closeout: confirm the definition of done and any unresolved
 * items, then record the Work Summary.
 *
 * Deliberately not a delete. §1.16 keeps the history — what was decided,
 * promised and delivered — and allows reopening later.
 */
export function CloseRequestDialog({
  requestId,
  closeHref,
  definitionOfDone,
  openCount,
  error,
}: {
  requestId: string;
  closeHref: string;
  definitionOfDone?: string | null;
  openCount: number;
  error?: string;
}) {
  return (
    <Modal title="Close this request" closeHref={closeHref}>
      <form action={closeRequest} className="flex flex-col gap-[18px]">
        <input type="hidden" name="request_id" value={requestId} />

        {error ? <Callout tone="danger">{error}</Callout> : null}

        {definitionOfDone ? (
          <div>
            <div
              className="mb-1 text-[12.5px] font-medium"
              style={{ color: "var(--text-tertiary)" }}
            >
              Definition of done
            </div>
            <p className="text-[13.5px] leading-[1.55]">{definitionOfDone}</p>
          </div>
        ) : null}

        {openCount > 0 ? (
          <Callout tone="warning">
            {openCount} {openCount === 1 ? "step is" : "steps are"} still
            unfinished. Closing keeps them on the record as unresolved, say so
            in the summary below if that&apos;s intended.
          </Callout>
        ) : null}

        <Field label="Work Summary" htmlFor="work_summary">
          <textarea
            id="work_summary"
            name="work_summary"
            required
            rows={5}
            placeholder="What was achieved, what was decided, and anything left open."
            className={`${CONTROL} resize-y`}
          />
        </Field>

        <p className="text-[12px]" style={{ color: "var(--text-tertiary)" }}>
          Closing preserves everything, timeline, documents, decisions. You can
          reopen this request later.
        </p>

        <div className="mt-1 flex justify-end gap-2.5">
          <Button href={closeHref} variant="secondary">
            Cancel
          </Button>
          <Submit variant="primary">
            Close Request
          </Submit>
        </div>
      </form>
    </Modal>
  );
}
