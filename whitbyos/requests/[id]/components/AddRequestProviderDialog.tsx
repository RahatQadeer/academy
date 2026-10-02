import { Button } from "@/base/components/Button";
import { Submit } from "@/base/components/Submit";
import { Callout } from "@/base/components/Callout";
import { Modal } from "@/whitbyos/components/Modal";
import { CONTROL, Field } from "@/whitbyos/components/Field";
import { attachRequestProvider } from "@/whitbyos/requests/actions";

/** Screen 3.3p — Add Provider to this Request from the directory. */
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
            Add a provider to the directory first, then link them here.
          </Callout>
        ) : (
          <Field label="Provider" htmlFor="provider_id">
            <select
              id="provider_id"
              name="provider_id"
              required
              className={`${CONTROL} text-[13.5px]`}
            >
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
