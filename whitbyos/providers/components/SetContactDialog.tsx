import { Button } from "@/base/components/Button";
import { Submit } from "@/base/components/Submit";
import { Callout } from "@/base/components/Callout";
import { Modal } from "@/whitbyos/components/Modal";
import { CONTROL, Field } from "@/whitbyos/components/Field";
import { setProviderContact } from "@/whitbyos/providers/actions";

/**
 * Who to speak to at this provider, chosen from the provider's own screen.
 *
 * A choice from `contacts` rather than two free-text lines, for the reason
 * Edit gives: §5.4 makes a person a canonical record shared with the Portal
 * and the Partner Center, so typing their name again would make a second copy
 * of somebody the workspace already has.
 *
 * The empty option is the way back from picking the wrong person, which a
 * dialog that can only ever set something does not have.
 */
export function SetContactDialog({
  providerId,
  providerName,
  contacts,
  contactId,
  closeHref,
  error,
}: {
  providerId: string;
  providerName: string;
  contacts: { id: string; name: string }[];
  contactId: string | null;
  closeHref: string;
  error?: string;
}) {
  return (
    <Modal title="Point of Contact" closeHref={closeHref} width={460}>
      <form action={setProviderContact} className="flex flex-col gap-4">
        <input type="hidden" name="provider_id" value={providerId} />

        {error ? <Callout tone="danger">{error}</Callout> : null}

        <p className="text-[13px] leading-[1.55]" style={{ margin: 0, color: "var(--text-secondary)" }}>
          {contacts.length === 0
            ? `Nobody is on file at ${providerName} yet. Add them under People on this page first, and they can be chosen here.`
            : `Which of the people at ${providerName} you deal with. Adding somebody new is done under People on this page.`}
        </p>

        <Field label="Contact" htmlFor="contact_id">
          <select
            id="contact_id"
            name="contact_id"
            defaultValue={contactId ?? ""}
            className={`${CONTROL} text-[13.5px]`}
          >
            <option value="">Nobody yet</option>
            {contacts.map((contact) => (
              <option key={contact.id} value={contact.id}>
                {contact.name}
              </option>
            ))}
          </select>
        </Field>

        <div className="flex justify-end gap-2.5">
          <Button unsized href={closeHref} variant="secondary" className="px-4 py-[9px] text-[13.5px]">
            Cancel
          </Button>
          <Submit unsized variant="primary" className="px-4 py-[9px] text-[13.5px]">
            Save
          </Submit>
        </div>
      </form>
    </Modal>
  );
}
