import { Button } from "@/base/components/Button";
import { Submit, SubmitPlain } from "@/base/components/Submit";
import { Callout } from "@/base/components/Callout";
import { Modal } from "@/whitbyos/components/Modal";
import { CONTROL, Field } from "@/whitbyos/components/Field";
import { removeProvider, updateProvider } from "@/whitbyos/providers/actions";
import {
  ProviderFields,
  type ProviderValues,
  type Teammate,
} from "@/whitbyos/providers/components/ProviderForm";
import type { CategoryOption } from "@/whitbyos/lib/taxonomy";

/**
 * Screen 5.1a — Edit Provider.
 *
 * The one field Add does not have: the person at the company. You cannot pick
 * someone at a company that does not exist yet, which is why it appears only
 * once the provider does.
 *
 * The export writes the contact as two free-text lines, name and email. Here it
 * is a choice from `contacts`, because §5.4 makes a person a canonical record
 * shared with the Portal and the Partner Center — typing their name again would
 * make a second copy of someone the workspace already has.
 */
export function EditProviderDialog({
  providerId,
  companyId,
  values,
  contacts,
  contactId,
  teammates,
  categories,
  usedSpecialties,
  atFirm,
  inherit,
  worksAt,
  returnTo,
  closeHref,
  error,
}: {
  providerId: string;
  companyId: string | null;
  values: ProviderValues;
  contacts: { id: string; name: string }[];
  contactId: string | null;
  teammates: Teammate[];
  categories: CategoryOption[];
  usedSpecialties: string[];
  /** Opened from inside the firm they are at: its answers are not re-asked. */
  atFirm?: { id: string; name: string } | null;
  inherit?: {
    category?: string | null;
    location?: string | null;
    source?: string | null;
    readiness?: string | null;
    outreach?: string | null;
  };
  /** Named on the locked type when this person works at a firm. */
  worksAt?: string | null;
  returnTo?: string;
  closeHref: string;
  error?: string;
}) {
  return (
    <Modal
      title={atFirm ? `Edit ${values.name ?? "person"}` : "Edit Provider"}
      closeHref={closeHref}
      width={560}
    >
      <form action={updateProvider} className="flex flex-col gap-4">
        {error ? <Callout tone="danger">{error}</Callout> : null}

        <input type="hidden" name="provider_id" value={providerId} />
        {returnTo ? <input type="hidden" name="return_to" value={returnTo} /> : null}
        <input type="hidden" name="company_id" value={companyId ?? ""} />

        <ProviderFields
          values={values}
          teammates={teammates}
          categories={categories}
          usedSpecialties={usedSpecialties}
          atFirm={atFirm}
          inherit={inherit}
          lockType
          worksAt={worksAt}
          showSource={false}
          showNote={false}
        />

        {/*
         * The people at this firm, and only them: a point of contact at Ahmed
         * & Partners is somebody at Ahmed & Partners, not anybody the
         * workspace happens to hold.
         *
         * Which leaves the case of a firm with nobody on file yet. The select
         * is then a dead end — one option, itself, and no hint that the answer
         * is a panel further down the page. So it says where to go instead of
         * sitting there empty.
         *
         * Not asked when this dialog is a person at the firm. Whose switchboard
         * to ring is the firm's answer, and offering it here made a partner's
         * save look as if it could retitle the firm.
         */}
        {atFirm || values.type === "individual" ? null : (
        <Field label="Point of contact" htmlFor="contact_id">
          <select
            id="contact_id"
            name="contact_id"
            defaultValue={contactId ?? ""}
            disabled={contacts.length === 0}
            className={`${CONTROL} text-[13.5px]`}
          >
            <option value="">No one recorded</option>
            {contacts.map((contact) => (
              <option key={contact.id} value={contact.id}>
                {contact.name}
              </option>
            ))}
          </select>
          {contacts.length === 0 ? (
            <p
              className="text-[12px] leading-[1.5]"
              style={{ margin: "6px 0 0", color: "var(--text-tertiary)" }}
            >
              Nobody is on file at this firm yet. Close this and add them under
              People on the provider, and they can be chosen here.
            </p>
          ) : null}
        </Field>
        )}

        <div className="mt-1 flex items-center justify-between gap-2.5">
          <Button unsized href={closeHref} variant="secondary" className="px-4 py-[9px] text-[13.5px]">
            Cancel
          </Button>

          <Submit unsized variant="primary" className="px-[18px] py-[9px] text-[13.5px]">
            Save Changes
          </Submit>
        </div>
      </form>

      {/* Its own form: Remove is the opposite of Save, not a second way to
          submit it. It sits below the pair rather than beside them so the
          destructive control is not one mis-click from the safe one.
          A person opened from the firm is taken off that firm from the People
          row, not removed as a provider from inside their name-and-role form. */}
      {atFirm ? null : (
      <form action={removeProvider} className="mt-4 border-t border-line pt-4">
        <input type="hidden" name="provider_id" value={providerId} />
        <SubmitPlain
         
          className="rounded-control border px-4 py-[9px] text-[13.5px] font-medium"
          style={{
            borderColor: "var(--danger-border)",
            color: "var(--danger-outline-fg)",
            background: "var(--surface)",
          }}
        >
          Remove Provider
        </SubmitPlain>
        <p className="mt-2 text-[12px]" style={{ color: "var(--text-tertiary)" }}>
          Takes them out of your directory. The company and its people stay on
          file, because they are shared with the rest of Private Attaché.
        </p>
      </form>
      )}
    </Modal>
  );
}
