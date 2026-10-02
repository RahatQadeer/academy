import { Button } from "@/base/components/Button";
import { Submit } from "@/base/components/Submit";
import { Pill } from "@/base/components/Pill";
import { Modal } from "@/whitbyos/components/Modal";
import { linkDocumentToRequest, requestSignature, resolveDocument } from "@/whitbyos/documents/actions";
import { documentDownloadHref } from "@/whitbyos/lib/document-vocab";
import { neededAction, type DocumentDetail } from "@/whitbyos/lib/documents";
import { shortDate } from "@/whitbyos/lib/format";
import { readSignature, signatureLine } from "@/whitbyos/lib/signing";

/**
 * Screen 12.3 — Document Detail.
 *
 * A read-out rather than a form: six rows of what is recorded, then Download
 * and, where something is waiting, the one action that clears it.
 *
 * The export's primary button says Mark Reviewed, which is right for a document
 * waiting to be read and wrong for one waiting on a signature — that goes out
 * to be signed elsewhere (§14.12) and comes back. So the button follows what
 * the document is actually waiting for, and a document waiting for nothing has
 * only Download.
 */
export function DocumentDetailDialog({
  document,
  closeHref,
  requests = [],
}: {
  document: DocumentDetail;
  closeHref: string;
  /**
   * The open client's Requests, so this document can be moved onto one.
   *
   * §12 allows a Document to be linked to a Request; only creation could do
   * it, so a file uploaded before its Request existed — the common way round —
   * stayed unlinked for good.
   */
  requests?: { id: string; title: string }[];
}) {
  const waitingFor = neededAction(document);
  // The round trip, read through the shared vocabulary so this screen and the
  // client's cannot disagree about one document.
  const signature = readSignature(document);
  const line = signatureLine(signature, "professional");

  return (
    <Modal title={document.title} closeHref={closeHref} width={560} dense>
      <div className="-mt-3 mb-[18px] flex flex-wrap items-center gap-2">
        {waitingFor ? (
          <Pill tone="warning">Action Needed, {waitingFor}</Pill>
        ) : document.status === "archived" ? (
          <Pill tone="neutral">Archived</Pill>
        ) : document.status === "completed" ? (
          <Pill tone="success">Completed</Pill>
        ) : (
          <Pill tone="neutral">Current</Pill>
        )}

        {document.labels.map((label) => (
          <span
            key={label}
            className="rounded border border-line px-[7px] py-px text-[10.5px]"
            style={{ color: "var(--text-secondary)" }}
          >
            {label}
          </span>
        ))}
      </div>

      <div className="mb-2">
        {requests.length > 0 ? (
          <Row label="Linked to">
            <form action={linkDocumentToRequest} className="flex items-center gap-2">
              <input type="hidden" name="document_id" value={document.id} />
              <input type="hidden" name="back" value={closeHref} />
              <select
                name="request_id"
                defaultValue={
                  document.contextType === "request" ? document.contextId : ""
                }
                className="rounded-control border border-line-strong bg-surface px-2 py-1 text-[12.5px]"
              >
                <option value="">Not linked to a Request</option>
                {requests.map((request) => (
                  <option key={request.id} value={request.id}>
                    {request.title}
                  </option>
                ))}
              </select>
              <Submit unsized variant="secondary" className="px-2.5 py-1 text-[12px]">
                Save
              </Submit>
            </form>
          </Row>
        ) : (
          <Row label="Linked to">{document.linkedTo ?? "Nothing"}</Row>
        )}
        <Row label="Version">{`v${document.version}`}</Row>
        <Row label="Effective date">{shortDate(document.effective_date) || "Not set"}</Row>
        <Row label="Signed / accepted">{shortDate(document.signed_date) || "Not signed"}</Row>
        <Row label="Shared by">
          {document.sharedBy
            ? document.uploadedBy && document.uploadedBy !== document.sharedBy
              ? `${document.sharedBy} (uploaded by ${document.uploadedBy})`
              : document.sharedBy
            : (document.uploadedBy ?? "Unknown")}
        </Row>
        <Row label="Uploaded">{shortDate(document.created_at) || "Not known"}</Row>
        {line ? (
          <Row label="Signature">
            <span className="inline-flex items-center gap-2">
              <Pill tone={line.tone}>{line.label}</Pill>
              {signature.at ? shortDate(signature.at) : null}
            </span>
          </Row>
        ) : null}
      </div>

      {/* What the other side said when they answered. A refusal without its
          reason is the half of the answer nobody can act on. */}
      {signature.note ? (
        <p
          className="mt-3 rounded-[8px] border border-line px-3.5 py-3 text-[13px] leading-[1.55]"
          style={{ margin: "12px 0 0", color: "var(--text-secondary)" }}
        >
          {signature.note}
        </p>
      ) : null}

      <div className="mt-[18px] flex flex-wrap items-center justify-between gap-2.5">
        <a
          href={documentDownloadHref(document.id)}
          className="inline-flex items-center justify-center rounded-control border border-line-strong px-4 py-[9px] text-[13.5px] font-medium no-underline"
          style={{ color: "var(--ink)" }}
        >
          Download
        </a>

        {/* Nobody has been asked yet, so asking is what this offers. Once the
            client has it, the row says so instead — sending twice would be two
            asks about one document and two notices about one of them. */}
        {!signature.state ? (
          <form action={requestSignature}>
            <input type="hidden" name="document_id" value={document.id} />
            <Submit unsized variant="secondary" className="px-4 py-[9px] text-[13.5px]">
              Send for signature
            </Submit>
          </form>
        ) : null}

        {waitingFor === "Review" ? (
          <form action={resolveDocument}>
            <input type="hidden" name="document_id" value={document.id} />
            <input type="hidden" name="action" value="review" />
            <Submit unsized variant="primary" className="px-[18px] py-[9px] text-[13.5px]">
              Mark Reviewed
            </Submit>
          </form>
        ) : waitingFor === "Sign" ? (
          <Button unsized
            href={`/whitbyos/documents?tab=action&sign=${document.id}`}
            variant="primary"
            className="px-[18px] py-[9px] text-[13.5px]"
          >
            Sign
          </Button>
        ) : null}
      </div>
    </Modal>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div
      className="flex justify-between gap-4 py-[9px] text-[13px]"
      style={{ borderBottom: "1px solid var(--canvas)" }}
    >
      <span style={{ color: "var(--text-tertiary)" }}>{label}</span>
      <span className="text-right font-medium">{children}</span>
    </div>
  );
}
