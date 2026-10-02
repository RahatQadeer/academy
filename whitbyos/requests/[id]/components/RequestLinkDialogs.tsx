import { Button } from "@/base/components/Button";
import { Submit } from "@/base/components/Submit";
import { Callout } from "@/base/components/Callout";
import { Modal } from "@/whitbyos/components/Modal";
import { CONTROL, Field } from "@/whitbyos/components/Field";
import { sendForm } from "@/whitbyos/forms/actions";
import { attachRequestProvider } from "@/whitbyos/requests/actions";

/** Screen 3.3f — send an existing Client Visible form onto this Request. */
export function AttachFormDialog({
  requestId,
  clientId,
  forms,
  closeHref,
  error,
}: {
  requestId: string;
  clientId: string;
  forms: { id: string; title: string }[];
  closeHref: string;
  error?: string;
}) {
  return (
    <Modal title="Attach Form" closeHref={closeHref} width={480}>
      <form action={sendForm} className="flex flex-col gap-4">
        <input type="hidden" name="client_id" value={clientId} />
        <input type="hidden" name="request_id" value={requestId} />
        <input type="hidden" name="return_to" value={closeHref} />
        {error ? <Callout tone="danger">{error}</Callout> : null}

        {forms.length === 0 ? (
          <Callout tone="warning">
            Create a Client Visible form first, then attach it here.
          </Callout>
        ) : (
          <Field label="Form" htmlFor="form_id">
            <select id="form_id" name="form_id" required className={`${CONTROL} text-[13.5px]`}>
              {forms.map((form) => (
                <option key={form.id} value={form.id}>
                  {form.title}
                </option>
              ))}
            </select>
          </Field>
        )}

        <div className="mt-1 flex justify-end gap-2.5">
          <Button unsized href={closeHref} variant="secondary" className="px-4 py-[9px] text-[13.5px]">
            Cancel
          </Button>
          <Submit unsized variant="primary" disabled={forms.length === 0} className="px-[18px] py-[9px] text-[13.5px]">
            Attach
          </Submit>
        </div>
      </form>
    </Modal>
  );
}

/** Screen 3.3p — add a directory provider to this Request. */
export function AddRequestProviderDialog({
  requestId,
  providers,
  closeHref,
  error,
}: {
  requestId: string;
  providers: { id: string; name: string }[];
  closeHref: string;
  error?: string;
}) {
  return (
    <Modal title="Add Provider" closeHref={closeHref} width={480}>
      <form action={attachRequestProvider} className="flex flex-col gap-4">
        <input type="hidden" name="request_id" value={requestId} />
        {error ? <Callout tone="danger">{error}</Callout> : null}

        {providers.length === 0 ? (
          <Callout tone="warning">
            Add a provider to the directory first, then attach them here.
          </Callout>
        ) : (
          <Field label="Provider" htmlFor="provider_id">
            <select id="provider_id" name="provider_id" required className={`${CONTROL} text-[13.5px]`}>
              {providers.map((provider) => (
                <option key={provider.id} value={provider.id}>
                  {provider.name}
                </option>
              ))}
            </select>
          </Field>
        )}

        <div className="mt-1 flex justify-end gap-2.5">
          <Button unsized href={closeHref} variant="secondary" className="px-4 py-[9px] text-[13.5px]">
            Cancel
          </Button>
          <Submit
            unsized
            variant="primary"
            disabled={providers.length === 0}
            className="px-[18px] py-[9px] text-[13.5px]"
          >
            Add Provider
          </Submit>
        </div>
      </form>
    </Modal>
  );
}
