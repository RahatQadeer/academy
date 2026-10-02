import { Modal } from "@/whitbyos/components/Modal";
import { DialogForm } from "@/whitbyos/components/DialogForm";
import { Callout } from "@/base/components/Callout";
import { CONTROL, Field } from "@/whitbyos/components/Field";
import { logCommunication } from "@/whitbyos/actions";
import { COMMUNICATION_KINDS, type RequestOption } from "@/whitbyos/lib/quick-log";
import type { ClientOption } from "@/whitbyos/lib/requests";

/**
 * Screen 1.2b — Log Communication.
 *
 * A call, a meeting, a text or a conversation in a room: things that happened
 * outside anything Whitby syncs. It sits alongside Updates rather than inside
 * Messages, because nothing about it came through a mailbox.
 */
export function LogCommunicationDialog({
  clients,
  requests,
  closeHref,
  error,
}: {
  clients: ClientOption[];
  requests: RequestOption[];
  closeHref: string;
  error?: string;
}) {
  return (
    <Modal title="Log Communication" closeHref={closeHref} width={520} dense>
      {error ? (
        <div className="mb-4">
          <Callout tone="danger">{error}</Callout>
        </div>
      ) : null}

      <DialogForm action={logCommunication} closeHref={closeHref} submitLabel="Log Communication" className="flex flex-col gap-4">
        <Field label="Type">
          {/* Four radios drawn as the export's chips. A select would have been
              easier and would have hidden three of the four. */}
          <div className="flex flex-wrap gap-2">
            {COMMUNICATION_KINDS.map((kind, index) => (
              <label
                key={kind.value}
                className="cursor-pointer rounded-control border border-line-strong px-3 py-[7px] text-[13px] has-[:checked]:border-accent has-[:checked]:bg-[var(--accent-tint)] has-[:checked]:text-[var(--accent)]"
              >
                <input
                  type="radio"
                  name="kind"
                  value={kind.value}
                  defaultChecked={index === 0}
                  className="sr-only"
                />
                {kind.label}
              </label>
            ))}
          </div>
        </Field>

        <Field label="Related Request" hint="(optional)" htmlFor="requestId">
          <select id="requestId" name="requestId" className={CONTROL} defaultValue="">
            <option value="">None</option>
            {requests.map((request) => (
              <option key={request.id} value={request.id}>
                {request.title}
              </option>
            ))}
          </select>
        </Field>

        {clients.length > 0 ? (
        <Field label="Link to Workspace" hint="(optional)" htmlFor="clientId">
          <select id="clientId" name="clientId" className={CONTROL} defaultValue="">
            <option value="">None</option>
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.name}
              </option>
            ))}
          </select>
        </Field>
        ) : null}

        <Field label="Summary" htmlFor="summary">
          <textarea
            id="summary"
            name="summary"
            rows={3}
            required
            placeholder="What was discussed? Any decisions or follow-ups?"
            className={CONTROL}
          />
        </Field>

        <Field label="Date & Time" htmlFor="occurredAt">
          {/* The export shows "Today, 2:30 PM" as a typed line. A real
              datetime control means the stored time is the one that happened,
              not the one this was filed. */}
          <input
            id="occurredAt"
            name="occurredAt"
            type="datetime-local"
            className={CONTROL}
          />
        </Field>

      </DialogForm>
    </Modal>
  );
}
