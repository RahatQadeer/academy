import { Button } from "@/base/components/Button";
import { Submit } from "@/base/components/Submit";
import { Callout } from "@/base/components/Callout";
import { Modal } from "@/whitbyos/components/Modal";
import { CONTROL, Field } from "@/whitbyos/components/Field";
import { updateContact } from "@/whitbyos/contacts/actions";
import type { ContactDetail } from "@/whitbyos/lib/contacts";

/**
 * 4.4's Edit.
 *
 * The export draws the button and not the dialog behind it, so this is 4.5's
 * shape with the fields 4.4 actually prints: how to reach them, where they are,
 * how they want to be dealt with, and what to know about them.
 *
 * Not here: which clients they belong to and in what role. That is a link
 * rather than a fact about the person, and it is granted and withdrawn on the
 * client's own Contacts tab, where the portal access that rides on it lives.
 */
export function EditContactDialog({
  contact,
  closeHref,
  error,
}: {
  contact: ContactDetail;
  closeHref: string;
  error?: string;
}) {
  return (
    <Modal title="Edit Contact" closeHref={closeHref} width={520}>
      <form action={updateContact} className="flex flex-col gap-4">
        <input type="hidden" name="contact_id" value={contact.id} />

        {error ? <Callout tone="danger">{error}</Callout> : null}

        <div className="flex gap-3">
          <Field label="First name" htmlFor="first_name" className="flex-1">
            <input id="first_name" name="first_name" required defaultValue={contact.firstName} className={CONTROL} />
          </Field>
          <Field label="Last name" htmlFor="last_name" className="flex-1">
            <input
              id="last_name"
              name="last_name"
              defaultValue={contact.lastName}
              className={CONTROL}
            />
          </Field>
        </div>

        <Field label="Title or role" htmlFor="title_role">
          <input
            id="title_role"
            name="title_role"
            defaultValue={contact.titleRole ?? ""}
            placeholder="e.g. Partner, or Son / Family Member"
            className={CONTROL}
          />
        </Field>

        <div className="flex gap-3">
          <Field label="Email" htmlFor="email" className="flex-1">
            <input
              id="email"
              name="email"
              type="email"
              defaultValue={contact.email ?? ""}
              className={CONTROL}
            />
          </Field>
          <Field label="Phone" htmlFor="phone" className="flex-1">
            <input id="phone" name="phone" defaultValue={contact.phone ?? ""} className={CONTROL} />
          </Field>
        </div>

        {/* A name rather than an offset: it is printed under the phone number
            for somebody deciding whether to call, not used to convert times. */}
        <Field label="Time zone" htmlFor="timezone">
          <input
            id="timezone"
            name="timezone"
            defaultValue={contact.timezone ?? ""}
            placeholder="e.g. Eastern Time (US)"
            className={CONTROL}
          />
        </Field>

        <Field label="Communication preferences" htmlFor="communication_preferences">
          <textarea
            id="communication_preferences"
            name="communication_preferences"
            defaultValue={contact.communicationPreferences ?? ""}
            placeholder="How they want to be reached, and when not to."
            className={`${CONTROL} min-h-[72px] resize-y`}
          />
        </Field>

        <Field label="Notes" htmlFor="notes">
          <textarea
            id="notes"
            name="notes"
            defaultValue={contact.notes ?? ""}
            placeholder="What somebody picking this relationship up would want to know."
            className={`${CONTROL} min-h-[72px] resize-y`}
          />
        </Field>

        <p className="-mt-1 text-[12px]" style={{ color: "var(--text-tertiary)" }}>
          A contact is shared across every client they are attached to, so this
          changes what all of them see.
        </p>

        <div className="mt-1 flex justify-end gap-2.5">
          <Button unsized href={closeHref} variant="secondary" className="px-4 py-[9px] text-[13.5px]">
            Cancel
          </Button>
          <Submit unsized variant="primary" className="px-[18px] py-[9px] text-[13.5px]">
            Save changes
          </Submit>
        </div>
      </form>
    </Modal>
  );
}
