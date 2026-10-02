import { Input } from "@/base/components/Input";
import { PORTAL_AREAS } from "@/client-portal/lib/access";
import { ACCESS_AREAS } from "@/whitbyos/lib/access-requests-vocab";
import { REQUESTABLE_ROLES, RELATIONSHIPS } from "@/client-portal/lib/data/people";
import { requestAccess } from "@/client-portal/lib/actions/people";
import { Modal } from "@/client-portal/components/Modal";
import {
  FieldGroup,
  CancelLink, FormActions,
  Select,
  Textarea,
} from "@/client-portal/components/Fields";
import { SubmitButton } from "@/client-portal/components/SubmitButton";
import { AreaSwitch } from "./AreaSwitch";

/**
 * The areas a client is most often asking for, ticked to start with.
 *
 * Taken from the professional's own approval screen rather than restated, so
 * the two sides open with the same suggestion and the professional is not made
 * to undo a default the client never chose. It was a written list of three,
 * and 2.1.2.1's defaults have since become six — the parity the list claimed
 * was already gone by the time anyone would have noticed, because nothing
 * fails when two hardcoded lists disagree about a default.
 *
 * `access-requests-vocab.ts` is vocabulary with no server imports, which is why
 * this can read it from the portal at all.
 */
/*
 * The professional's own starting position, read from their workspace rather
 * than restated here.
 *
 * This was a second hardcoded list beside theirs, and the comment above it
 * already admitted the two had drifted. Now the same setting feeds both
 * screens, so what a client ticks is what the professional is shown.
 */

/**
 * A request, never a grant. The client supplies who, why, and which areas they
 * have in mind; the professional approves, edits, or declines on 2.1.2.1, and
 * only then does an invitation go out.
 *
 * The area ticks are a suggestion the professional can overrule, and the modal
 * says so — a client who thinks they have granted Billing and finds they have
 * not is worse off than one who was told it was a request all along.
 */
export function AddPersonModal({
  closeHref,
  returnTo,
  action = requestAccess,
  defaultAreas,
}: {
  /** From the professional's Settings → Workspace. */
  defaultAreas: string[];
  closeHref: string;
  returnTo: string;
  action?: (formData: FormData) => void | Promise<void>;
}) {
  const defaults = new Set(defaultAreas);

  return (
    <Modal
      title="Request to add someone"
      description="We'll send this to your advisor for review before anyone is invited."
      closeHref={closeHref}
      width={560}
    >
      <form action={action}>
        <input type="hidden" name="returnTo" value={returnTo} />
        <FieldGroup>
          <Input
            label="Name"
            name="personName"
            required
            maxLength={120}
            placeholder="Full name"
          />
          <Input
            label="Email Address"
            name="personEmail"
            type="email"
            required
            maxLength={160}
            placeholder="name@email.com"
          />
          <Select
            label="Relationship"
            name="relationship"
            placeholder="Select a relationship"
            options={RELATIONSHIPS.map((value) => ({ value, label: value }))}
          />
          <Select
            label="Access Role"
            name="requestedRole"
            placeholder="Select a role"
            options={REQUESTABLE_ROLES.map((role) => ({
              value: role.value,
              label: `${role.label} — ${role.help}`,
            }))}
          />

          <fieldset>
            <legend
              className="mb-1.5 block text-[12.5px] font-medium"
              style={{ color: "var(--text-tertiary)" }}
            >
              What can they access?
            </legend>
            <p
              className="mb-2.5 text-[12.5px] leading-snug"
              style={{ color: "var(--text-tertiary)" }}
            >
              What you would like them to reach. Your team sets the final
              permissions and may change these.
            </p>
            <div className="overflow-hidden rounded-[8px] border border-line">
              {PORTAL_AREAS.map((area) => (
                <AreaSwitch
                  key={area.key}
                  value={area.key}
                  label={area.label}
                  hint={area.what}
                  defaultChecked={defaults.has(area.key)}
                />
              ))}
            </div>
          </fieldset>

          <Textarea
            label="Why they need access"
            name="reason"
            rows={3}
            placeholder="A sentence is plenty, it helps your team set the right permissions."
          />
        </FieldGroup>

        <FormActions>
          <CancelLink href={closeHref} />
          <SubmitButton pendingLabel="Sending…">
            Send for advisor review
          </SubmitButton>
        </FormActions>
      </form>
    </Modal>
  );
}
