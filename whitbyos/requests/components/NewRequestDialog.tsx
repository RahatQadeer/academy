import { Callout } from "@/base/components/Callout";
import { Modal } from "@/whitbyos/components/Modal";
import { CONTROL, Field } from "@/whitbyos/components/Field";
import { createRequest } from "@/whitbyos/requests/actions";
import { DialogForm } from "@/whitbyos/components/DialogForm";
import type { ClientOption } from "@/whitbyos/lib/requests";

/** Posted when the request is not tied to a client. */
export const NO_CLIENT = "none";

export function NewRequestDialog({
  clients,
  closeHref,
  error,
  defaultClientId,
  from,
  usesClientWorkspaces = true,
}: {
  clients: ClientOption[];
  closeHref: string;
  error?: string;
  defaultClientId?: string;
  /** "home" when Quick Add opened this over the Dashboard (1.2). */
  from?: "home";
  usesClientWorkspaces?: boolean;
}) {
  /*
   * With a client open: that client + None. Other clients stay out — this
   * screen is about not leaking their work into the open workspace.
   * With nobody open (All requests): every client + None.
   */
  const choices =
    defaultClientId && clients.some((row) => row.id === defaultClientId)
      ? clients.filter((row) => row.id === defaultClientId)
      : clients;

  return (
    <Modal title="New Request" closeHref={closeHref}>
      <DialogForm
        action={createRequest}
        closeHref={closeHref}
        submitLabel="Create Request"
        pendingLabel="Creating…"
        className="flex flex-col gap-[18px]"
      >
        {from ? <input type="hidden" name="from" value={from} /> : null}
        {error ? <Callout tone="danger">{error}</Callout> : null}

        {usesClientWorkspaces ? (
          <Field label="Client" htmlFor="client_id" hint="(optional)">
            <select
              id="client_id"
              name="client_id"
              defaultValue={defaultClientId ?? NO_CLIENT}
              className={CONTROL}
            >
              <option value={NO_CLIENT}>None</option>
              {choices.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </select>
          </Field>
        ) : null}

        <Field label="Title" htmlFor="title" required>
          <input
            id="title"
            name="title"
            required
            placeholder="Enter title"
            className={CONTROL}
          />
        </Field>

        <Field label="Description" htmlFor="desired_outcome">
          <textarea
            id="desired_outcome"
            name="desired_outcome"
            rows={3}
            placeholder="Enter description"
            className={`${CONTROL} resize-y`}
          />
        </Field>

        <Field label="Due date" htmlFor="target_date" hint="(optional)">
          <input id="target_date" name="target_date" type="date" className={CONTROL} />
        </Field>
      </DialogForm>
    </Modal>
  );
}
