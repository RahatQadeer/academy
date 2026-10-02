import { Input } from "@/base/components/Input";
import { Modal } from "@/client-portal/components/Modal";
import { FieldGroup, CancelLink, FormActions } from "@/client-portal/components/Fields";
import { SubmitButton } from "@/client-portal/components/SubmitButton";
import { uploadDocument } from "@/client-portal/lib/actions/documents";

export function UploadModal({ closeHref }: { closeHref: string }) {
  return (
    <Modal
      title="Upload a document"
      description="Anything you upload is shared with your team and visible to you."
      closeHref={closeHref}
    >
      {/* React sets the encoding for a server action; saying it here is
          overridden, with a console error to say so. */}
      <form action={uploadDocument}>
        <FieldGroup>
          <label className="block">
            <span
              className="mb-1.5 block text-[12.5px] font-medium"
              style={{ color: "var(--text-tertiary)" }}
            >
              File
            </span>
            <input
              type="file"
              name="file"
              required
              className="w-full rounded-control border border-line-strong bg-surface px-3 py-[9px] text-[13.5px] file:mr-3 file:rounded-control file:border-0 file:bg-surface-soft file:px-3 file:py-1.5 file:text-[13px]"
            />
            <span
              className="mt-1 block text-[12px]"
              style={{ color: "var(--text-tertiary)" }}
            >
              Up to 25 MB.
            </span>
          </label>
          <Input
            label="Title"
            name="title"
            maxLength={140}
            placeholder="Leave blank to use the file name"
          />
          <Input
            label="Label (optional)"
            name="label"
            maxLength={40}
            placeholder="e.g. Tax, Agreement, 2026"
          />
        </FieldGroup>

        <FormActions>
          <CancelLink href={closeHref} />
          <SubmitButton pendingLabel="Uploading…">Upload</SubmitButton>
        </FormActions>
      </form>
    </Modal>
  );
}
