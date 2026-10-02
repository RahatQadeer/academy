import { Button } from "@/base/components/Button";
import { BUTTON_SIZE } from "@/client-portal/components/buttons";
import { Pill } from "@/base/components/Pill";
import { relativeTime, shortDate } from "@/client-portal/lib/format";
import { DOCUMENT_STATUS, documentActionLabel } from "@/client-portal/lib/status";
import {
  addDocumentLabel,
  downloadDocument,
  requestProfessionalSignature,
} from "@/client-portal/lib/actions/documents";
import { signatureLine } from "@/whitbyos/lib/signing";
import {
  PanelBody,
  PanelMeta,
  PanelRow,
  PanelRows,
  PanelTags,
  PanelTitle,
} from "@/client-portal/components/Panel";
import { StatusPill } from "@/client-portal/components/StatusPill";
import { SubmitButton } from "@/client-portal/components/SubmitButton";
import type { PortalDocument } from "@/client-portal/types";

/**
 * The client's paperwork, as rows in the portal's list panel.
 *
 * This was a six-column table 1040px wide, which meant it scrolled sideways on
 * every phone and most tablets — for a list whose whole job is to be glanced
 * at. What each row has to say is short: what the file is, which request it
 * belongs to, where it stands, and the one or two things that can be done with
 * it. As a row that is three lines and a tile, and it fits.
 *
 * A row that only reads — Download, Sign, Ask for signature — keeps its
 * controls on a line of their own beneath, because they are forms and buttons,
 * and a button inside a link is markup the browser unpicks however it likes.
 */
export function DocumentList({
  documents,
  showLabelForm = false,
  uploadHref = "/client-portal/documents?upload=1",
  signHref,
  timeZone = "UTC",
}: {
  documents: PortalDocument[];
  showLabelForm?: boolean;
  /**
   * Where Upload and Update send the client. Both ask for a file rather than
   * offering one, so neither can go through `downloadDocument` — an Upload row
   * has no file at all, and that button used to open a dialog saying the
   * document was no longer available.
   *
   * `null` for a reader who may not upload, which is not the same as leaving it
   * out: an omitted prop takes the default above, so passing `undefined` to
   * turn the button off silently turned it back on. The rows then say what is
   * outstanding without offering a button that would refuse them.
   */
  uploadHref?: string | null;
  /** Where a document waiting on this client's signature is answered. */
  signHref?: ((documentId: string) => string) | null;
  timeZone?: string;
}) {
  return (
    <PanelRows>
      {documents.map((doc) => {
        const signature = doc.signature ?? {
          requiredFrom: null,
          state: null,
          note: null,
          at: null,
        };
        const line = signatureLine(signature, "client");
        // Asking is offered on a document that has a file and is not already
        // in the middle of being asked about. A read-only member has no
        // `signHref`, and nothing here is theirs to send either.
        const canAsk = Boolean(signHref) && !signature.state && Boolean(doc.fileUrl);

        const expired = doc.expiresAt && new Date(doc.expiresAt).getTime() < Date.now();

        return (
          <PanelRow
            key={doc.id}
            when={relativeTime(doc.sharedAt)}
            trailing={
              <>
                {/* Signing used to happen somewhere else entirely — DocuSign,
                    a notary, a wet signature — so the row could only state the
                    ask. It happens here now, so it offers the answer. */}
                {doc.actionType === "sign" ? (
                  signHref ? (
                    <Button
                      href={signHref(doc.id)}
                      variant="primary"
                      unsized
                      className={BUTTON_SIZE.row}
                    >
                      Sign
                    </Button>
                  ) : null
                ) : canAsk ? (
                  // The other direction: a client's own paperwork needs signing
                  // as often as the firm's does, and only the firm could ask.
                  <form action={requestProfessionalSignature}>
                    <input type="hidden" name="documentId" value={doc.id} />
                    <SubmitButton variant="secondary" size="row" pendingLabel="Sending…">
                      Ask for signature
                    </SubmitButton>
                  </form>
                ) : null}

                {doc.actionType === "upload" ? (
                  // Nothing to open: the row exists to say a file is missing.
                  uploadHref ? (
                    <Button
                      href={uploadHref}
                      variant="secondary"
                      unsized
                      className={BUTTON_SIZE.row}
                    >
                      {documentActionLabel(doc.actionType)}
                    </Button>
                  ) : null
                ) : (
                  <>
                    {/* An expiring document is replaced, not just read — but
                        the one on file is still there to check first. */}
                    {doc.actionType === "update" && uploadHref ? (
                      <Button
                        href={uploadHref}
                        variant="secondary"
                        unsized
                        className={BUTTON_SIZE.row}
                      >
                        {documentActionLabel(doc.actionType)}
                      </Button>
                    ) : null}
                    <form action={downloadDocument}>
                      <input type="hidden" name="documentId" value={doc.id} />
                      <SubmitButton variant="secondary" size="row" pendingLabel="Opening…">
                        {doc.actionType === "review"
                          ? documentActionLabel(doc.actionType)
                          : "Download"}
                      </SubmitButton>
                    </form>
                  </>
                )}

                {/* Labels, and the way to add one. The form is folded behind a
                    "+ Label" chip rather than drawn open on every row: an input
                    and a button under each file made a list of eight documents
                    sixteen lines tall, for something done now and then. A
                    <details> keeps it a plain server form with no script, and
                    opening one grows only that row. */}
                {showLabelForm ? (
                  <details className="group">
                    <summary
                      className="inline-flex cursor-pointer list-none items-center rounded-full border border-dashed px-[9px] py-[3px] text-[11px] font-medium transition-colors hover:bg-[var(--surface-active)] [&::-webkit-details-marker]:hidden"
                      style={{ borderColor: "var(--border-strong)", color: "var(--text-tertiary)" }}
                    >
                      <span className="pa-when-closed">+ Label</span>
                      <span className="pa-when-open">Close</span>
                    </summary>
                    <form action={addDocumentLabel} className="mt-1.5 flex items-center gap-1.5">
                      <input type="hidden" name="documentId" value={doc.id} />
                      <input
                        name="label"
                        aria-label={`Add a label to ${doc.title}`}
                        placeholder="New label"
                        maxLength={40}
                        required
                        className="w-[110px] min-w-0 rounded-control border px-2 py-[3px] text-[12px] outline-none focus:border-accent"
                        style={{
                          background: "var(--chat-field)",
                          borderColor: "var(--chat-line)",
                          color: "var(--ink)",
                        }}
                      />
                      <SubmitButton variant="secondary" size="row" pendingLabel="…">
                        Add
                      </SubmitButton>
                    </form>
                  </details>
                ) : null}
              </>
            }
          >

            <PanelBody>
              <PanelTitle>{doc.title}</PanelTitle>

              {/* What identifies this file rather than another version of it,
                  and who it came from. */}
              <PanelMeta>
                {[
                  doc.requestTitle,
                  `v${doc.version}`,
                  doc.sizeLabel,
                  doc.sharedByName ? `Shared by ${doc.sharedByName}` : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </PanelMeta>

              <PanelTags>
                <StatusPill status={DOCUMENT_STATUS[doc.status]} />
                {/* Where the signing has got to, whichever side it waits on.
                    The client who sent a document for signature needs to see
                    that it went and that nobody has answered, or they send it
                    again. */}
                {line ? <Pill tone={line.tone}>{line.label}</Pill> : null}
                {/* The one fact on this row that can turn a document into
                    work. */}
                {doc.expiresAt ? (
                  <Pill tone={doc.actionType === "update" || expired ? "warning" : "neutral"}>
                    {expired
                      ? `Expired ${shortDate(doc.expiresAt, new Date(), timeZone)}`
                      : `Expires ${shortDate(doc.expiresAt, new Date(), timeZone)}`}
                  </Pill>
                ) : null}
                {doc.labels.map((label) => (
                  <Pill key={label} tone="neutral">
                    {label}
                  </Pill>
                ))}
              </PanelTags>
            </PanelBody>
          </PanelRow>
        );
      })}
    </PanelRows>
  );
}
