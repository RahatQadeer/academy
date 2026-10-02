import { Button } from "@/base/components/Button";
import { Submit } from "@/base/components/Submit";
import { Callout } from "@/base/components/Callout";
import { Modal } from "@/whitbyos/components/Modal";
import { CONTROL, Field } from "@/whitbyos/components/Field";
import { draftUpdate, recordPlansUpdate } from "@/whitbyos/updates/actions";
import { UPDATE_CATEGORIES } from "@/whitbyos/lib/update-vocab";

type Option = { id: string; title: string };

/**
 * Screen 10.1 — Draft Progress Update.
 *
 * The export shows Whitby having flagged the update urgent, with an explanation
 * ("mentions a deadline"). Whitby cannot read the text here — that is the AI
 * layer, and it is not wired — so urgency is a checkbox the professional ticks,
 * with the consequence spelled out beside it rather than a machine's reasoning
 * we would be making up.
 */
export function DraftUpdateDialog({
  requests,
  update,
  closeHref,
  error,
}: {
  requests: Option[];
  /** The update being edited, or null when this is a new one. */
  update?: {
    id: string;
    headline: string;
    body: string;
    category: string | null;
    urgent: boolean;
    requestId: string | null;
  } | null;
  closeHref: string;
  error?: string;
}) {
  return (
    <Modal title="Draft Progress Update" closeHref={closeHref} width={600}>
      <form action={draftUpdate} className="flex flex-col gap-4">
        {update ? <input type="hidden" name="update_id" value={update.id} /> : null}
        {error ? <Callout tone="danger">{error}</Callout> : null}

        {requests.length === 0 ? (
          <Callout tone="warning">
            An update is about a Request, and there are none yet. Start a Request
            first and this will have something to report on.
          </Callout>
        ) : null}

        <Field label="Request" htmlFor="request_id">
          <select
            id="request_id"
            name="request_id"
            required
            defaultValue={update?.requestId ?? undefined}
            className={`${CONTROL} text-[13.5px]`}
          >
            {requests.map((request) => (
              <option key={request.id} value={request.id}>
                {request.title}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Headline" htmlFor="headline">
          <input
            id="headline"
            name="headline"
            required
            defaultValue={update?.headline ?? ""}
            placeholder="What has moved, in one line"
            className={CONTROL}
          />
        </Field>

        <Field label="Category" htmlFor="category">
          <select
            id="category"
            name="category"
            defaultValue={update?.category ?? "General"}
            className={`${CONTROL} text-[13.5px]`}
          >
            {UPDATE_CATEGORIES.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Summary for client" htmlFor="body">
          <textarea
            id="body"
            name="body"
            defaultValue={update?.body ?? ""}
            className={`${CONTROL} min-h-[90px] resize-y`}
            placeholder="Written for them to read, not for your own notes."
          />
        </Field>

        <label
          className="flex items-start gap-2.5 rounded-[8px] border px-3.5 py-3 text-[12.5px]"
          style={{ background: "var(--warning-bg)", borderColor: "var(--warning-border)", color: "var(--warning-fg)" }}
        >
          <input
            type="checkbox"
            name="urgent"
            defaultChecked={update?.urgent ?? false}
            className="mt-0.5 h-[15px] w-[15px] shrink-0"
            style={{ accentColor: "var(--danger-solid, #b3261e)" }}
          />
          <span>
            <strong>Mark urgent.</strong> Urgent updates stand out on this list
            and in the client&apos;s portal. Nothing is emailed, because no
            mailbox is connected yet.
          </span>
        </label>

        {/* 10.1's three ways out. Save as Draft was missing, which left no way
            to put an update down half-written, the only exits sent it to a
            colleague or to the client. */}
        <div className="mt-1 flex justify-end gap-2.5">
          <button
            type="submit"
            name="then"
            value="draft"
            className="rounded-control border border-line-strong px-4 py-[9px] text-[13.5px] font-medium"
            style={{ background: "var(--surface)", color: "var(--ink)" }}
          >
            Save as Draft
          </button>
          <button
            type="submit"
            name="then"
            value="review"
            className="rounded-control border border-line-strong px-4 py-[9px] text-[13.5px] font-medium"
            style={{ background: "var(--surface)", color: "var(--ink)" }}
          >
            Send for Review
          </button>
          <Submit unsized
           
            name="then"
            value="publish"
            variant="primary"
            className="px-[18px] py-[9px] text-[13.5px]"
          >
            Publish to Client
          </Submit>
        </div>
      </form>
    </Modal>
  );
}

/** 10.2's other half — writing down what a client has told you. */
export function PlansUpdateDialog({
  clients,
  closeHref,
  error,
}: {
  clients: Option[];
  closeHref: string;
  error?: string;
}) {
  return (
    <Modal title="Record a Plans update" closeHref={closeHref} width={520}>
      <form action={recordPlansUpdate} className="flex flex-col gap-4">
        {error ? <Callout tone="danger">{error}</Callout> : null}

        <p className="-mt-1 text-[13px] leading-[1.6]" style={{ color: "var(--text-secondary)" }}>
          Something the client has told you that changes how their work has to
          run, such as travel, a new assistant, or a move they are
          considering. Kept on the account rather than sent to them.
        </p>

        <Field label="Client" htmlFor="client_id">
          <select id="client_id" name="client_id" required className={`${CONTROL} text-[13.5px]`}>
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.title}
              </option>
            ))}
          </select>
        </Field>

        <Field label="What they told you" htmlFor="body">
          <textarea
            id="body"
            name="body"
            required
            className={`${CONTROL} min-h-[86px] resize-y`}
            placeholder="e.g. Travelling to Aspen Dec 18 – Jan 3, unavailable for calls"
          />
        </Field>

        <div className="mt-1 flex justify-end gap-2.5">
          <Button unsized href={closeHref} variant="secondary" className="px-4 py-[9px] text-[13.5px]">
            Cancel
          </Button>
          <Submit unsized variant="primary" className="px-[18px] py-[9px] text-[13.5px]">
            Record it
          </Submit>
        </div>
      </form>
    </Modal>
  );
}
