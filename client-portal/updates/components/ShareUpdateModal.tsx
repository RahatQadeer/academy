import { Modal } from "@/client-portal/components/Modal";
import { CancelLink, FormActions, Textarea } from "@/client-portal/components/Fields";
import { SubmitButton } from "@/client-portal/components/SubmitButton";
import { sharePlanUpdate } from "@/client-portal/lib/actions/updates";

export function ShareUpdateModal({ closeHref }: { closeHref: string }) {
  return (
    <Modal
      title="Share an update"
      description="Plans, dates, changes, or context your team should know about."
      closeHref={closeHref}
    >
      <form action={sharePlanUpdate}>
        <Textarea
          label="Your update"
          name="body"
          rows={5}
          required
          placeholder="e.g. We'll be in Barcelona from the 3rd to the 11th."
          hint="This does not create a request. Your team will follow up if coordination is needed."
        />
        <FormActions>
          <CancelLink href={closeHref} />
          <SubmitButton pendingLabel="Sharing…">Share</SubmitButton>
        </FormActions>
      </form>
    </Modal>
  );
}
