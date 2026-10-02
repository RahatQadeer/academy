import { Button } from "@/base/components/Button";
import { Submit } from "@/base/components/Submit";
import { Callout } from "@/base/components/Callout";
import { Modal } from "@/whitbyos/components/Modal";
import { CONTROL, Field } from "@/whitbyos/components/Field";
import { FileDropzone } from "@/whitbyos/documents/components/FileDropzone";
import { LabelChips } from "@/whitbyos/documents/components/LabelChips";
import { uploadDocument } from "@/whitbyos/documents/actions";
import { DOCUMENT_STATUS, VISIBILITY } from "@/whitbyos/lib/document-vocab";

/**
 * Screen 12.2 — Upload Document.
 *
 * Dropzone, title, optional client/request link, preset label chips, Upload.
 *
 * Status, visibility and the two dates used to stay off this modal — "a new
 * file is current and internal until something later says otherwise". Nothing
 * later ever said otherwise: `uploadDocument` reads all four and no form in the
 * product sent any of them, so every document ever uploaded was Current,
 * Internal, and dated nowhere. The detail screen printed "Not set" twice with
 * nothing able to set it.
 *
 * Visibility is the one that mattered most. The Portal shows `client_visible`
 * rows and nothing else, so a document uploaded for a client could never reach
 * them — including one sent for signature, which is a document they have to be
 * able to open.
 */
export function UploadDocumentDialog({
  contexts,
  clientName,
  closeHref,
  error,
  defaultContext,
  returnTo,
  showClients = true,
}: {
  contexts: { value: string; label: string }[];
  /** The client workspace that is open, when one is: what "none" files against. */
  clientName?: string | null;
  closeHref: string;
  error?: string;
  defaultContext?: string;
  returnTo?: string;
  showClients?: boolean;
}) {
  return (
    <Modal title="Upload Document" closeHref={closeHref} width={560}>
      <form action={uploadDocument} className="flex flex-col gap-4">
        {returnTo ? <input type="hidden" name="return_to" value={returnTo} /> : null}
        {error ? <Callout tone="danger">{error}</Callout> : null}

        <FileDropzone />

        <Field label="Title" htmlFor="title">
          <input
            id="title"
            name="title"
            required
            placeholder="Enter a title"
            className={CONTROL}
          />
        </Field>

        <Field
          label={clientName ? "Link to a Request" : "Link to a Request or Provider"}
          hint="(optional)"
          htmlFor="context"
        >
          <select
            id="context"
            name="context"
            defaultValue={defaultContext ?? ""}
            className={CONTROL}
          >
            <option value="">
              {clientName ? `Not linked, filed on ${clientName}` : "None, not linked yet"}
            </option>
            {contexts.map((context) => (
              <option key={context.value} value={context.value}>
                {context.label}
              </option>
            ))}
          </select>
        </Field>

        <div className="flex gap-3">
          <Field label="Who can see it" htmlFor="visibility" className="flex-1">
            <select
              id="visibility"
              name="visibility"
              defaultValue="internal"
              className={CONTROL}
            >
              {VISIBILITY.filter((option) => showClients || option.value !== "client_visible").map(
                (option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ),
              )}
            </select>
          </Field>

          <Field label="Status" htmlFor="status" className="flex-1">
            <select id="status" name="status" defaultValue="current" className={CONTROL}>
              {DOCUMENT_STATUS.filter((option) => option.value !== "archived").map(
                (option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ),
              )}
            </select>
          </Field>
        </div>

        <div className="flex gap-3">
          <Field label="Effective date" hint="(optional)" htmlFor="effective_date" className="flex-1">
            <input id="effective_date" name="effective_date" type="date" className={CONTROL} />
          </Field>

          {/* What makes a document ask to be replaced — `documentActionFor`
              reads it, and nothing could write it until now, so Update was an
              action no document ever arrived at on its own. */}
          <Field label="Expires" hint="(optional)" htmlFor="expires_at" className="flex-1">
            <input id="expires_at" name="expires_at" type="date" className={CONTROL} />
          </Field>
        </div>

        <Field label="Labels">
          <LabelChips />
        </Field>

        <div className="mt-1 flex justify-end gap-2.5">
          <Button unsized href={closeHref} variant="secondary" className="px-4 py-[9px] text-[13.5px]">
            Cancel
          </Button>
          <Submit unsized variant="primary" className="px-[18px] py-[9px] text-[13.5px]">
            Upload
          </Submit>
        </div>
      </form>
    </Modal>
  );
}
