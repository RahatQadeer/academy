import { Input } from "@/base/components/Input";
import { Modal } from "@/client-portal/components/Modal";
import { FieldGroup, CancelLink, FormActions, Textarea } from "@/client-portal/components/Fields";
import { SubmitButton } from "@/client-portal/components/SubmitButton";
import { submitRequest } from "@/client-portal/lib/actions/requests";

export function NewRequestModal({ closeHref }: { closeHref: string }) {
  return (
    <Modal
      title="New Request"
      description="Tell us what you need and we'll take it from here."
      closeHref={closeHref}
    >
      <form action={submitRequest}>
        <FieldGroup>
          <Input
            label="Title"
            name="title"
            required
            maxLength={140}
            placeholder="e.g. Book a private chef for July 4th"
          />
          <Textarea
            label="Description"
            name="description"
            rows={5}
            placeholder="Tell us what you need and any details that would help."
          />
        </FieldGroup>

        <p className="mt-4 text-[12.5px]" style={{ color: "var(--text-tertiary)" }}>
          Attachments can be added from Documents once the request is open.
        </p>

        <FormActions>
          <CancelLink href={closeHref} />
          <SubmitButton pendingLabel="Submitting…">Submit Request</SubmitButton>
        </FormActions>
      </form>
    </Modal>
  );
}
