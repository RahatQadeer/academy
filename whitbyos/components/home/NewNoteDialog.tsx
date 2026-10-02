import { Modal } from "@/whitbyos/components/Modal";
import { DialogForm } from "@/whitbyos/components/DialogForm";
import { Callout } from "@/base/components/Callout";
import { CONTROL, Field } from "@/whitbyos/components/Field";
import { saveQuickNote } from "@/whitbyos/actions";
import type { RequestOption } from "@/whitbyos/lib/quick-log";
import type { ClientOption } from "@/whitbyos/lib/requests";

/** Screen 1.2c — a quick internal thought, before it is lost. */
export function NewNoteDialog({
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
    <Modal title="New Note" closeHref={closeHref} width={520} dense>
      {error ? (
        <div className="mb-4">
          <Callout tone="danger">{error}</Callout>
        </div>
      ) : null}

      <DialogForm action={saveQuickNote} closeHref={closeHref} submitLabel="Save Note" className="flex flex-col gap-4">
        <Field label="Note" htmlFor="body">
          <textarea
            id="body"
            name="body"
            rows={4}
            required
            autoFocus
            placeholder="Jot down a quick thought or bit of internal context…"
            className={CONTROL}
          />
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

      </DialogForm>
    </Modal>
  );
}
