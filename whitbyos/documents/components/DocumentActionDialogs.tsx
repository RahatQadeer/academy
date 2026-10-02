import { Button } from "@/base/components/Button";
import { Submit } from "@/base/components/Submit";
import { Callout } from "@/base/components/Callout";
import { Modal } from "@/whitbyos/components/Modal";
import { CONTROL_UNSIZED, Field } from "@/whitbyos/components/Field";
import { FileDropzone } from "@/whitbyos/documents/components/FileDropzone";
import { updateDocument } from "@/whitbyos/documents/actions";

/**
 * Screen 12.6 — Update Document.
 *
 * Dropzone and a new effective date. The replaced version is kept and marked,
 * not overwritten — §1.16 keeps the record of what was in force when.
 */
export function UpdateDocumentDialog({
  documentId,
  title,
  expires,
  closeHref,
  error,
}: {
  documentId: string;
  title: string;
  expires: string | null;
  closeHref: string;
  error?: string;
}) {
  return (
    <Modal title="Update Document" closeHref={closeHref} width={560} dense>
      <p className="mb-[18px] text-[12.5px]" style={{ color: "var(--text-tertiary)" }}>
        Replacing &ldquo;{title}&rdquo;
        {expires ? `, current version expires ${expires}` : ""}. The prior version
        stays in version history.
      </p>

      <form action={updateDocument} className="flex flex-col gap-[18px]">
        <input type="hidden" name="document_id" value={documentId} />

        {error ? <Callout tone="danger">{error}</Callout> : null}

        <FileDropzone
          prompt="Drop the renewed file here or click to browse"
          hint="PDF, DOCX, PNG, or JPG up to 25MB"
        />

        <Field label="New effective date" htmlFor="effective_date">
          <input
            id="effective_date"
            name="effective_date"
            type="date"
            className={`${CONTROL_UNSIZED} text-[13.5px]`}
          />
        </Field>

        <div className="flex justify-end gap-2.5">
          <Button unsized href={closeHref} variant="secondary" className="px-4 py-[9px] text-[13.5px]">
            Cancel
          </Button>
          <Submit unsized variant="primary" className="px-[18px] py-[9px] text-[13.5px]">
            Save New Version
          </Submit>
        </div>
      </form>
    </Modal>
  );
}
