import { Submit } from "@/base/components/Submit";
import { SignWorkspace } from "@/base/components/signing/SignWorkspace";
import { isSignablePdf } from "@/base/lib/signing/placement";
import { createClient } from "@/base/lib/supabase/server";
import { CONTROL_UNSIZED } from "@/whitbyos/components/Field";
import {
  declineSignature,
  resolveDocument,
  signDocumentOnScreen,
  uploadSignedCopyFile,
} from "@/whitbyos/documents/actions";
import { documentDownloadHref } from "@/whitbyos/lib/document-vocab";
import { DOCUMENTS_BUCKET } from "@/whitbyos/lib/document-storage";
import type { DocumentRow } from "@/whitbyos/lib/documents";
import { isWaitingOn, readSignature } from "@/whitbyos/lib/signing";

/**
 * Screen 21a2 — signing, on the professional's side.
 *
 * The same screen the client signs on in the Portal: the document on the
 * right, the typed signature on the left, dragged to wherever it goes. It
 * replaces the "Upload Signed Copy" dialog, whose drawing pad saved a picture
 * of a signature beside the document rather than on it.
 *
 * What that dialog could also do is kept under "Sign on paper": record a link
 * to a copy signed in somebody else's system, or record the signature before
 * any copy has come back. A contract signed in a counterparty's account can
 * take days to arrive, and the row should not misreport the work meanwhile.
 */
export async function SignDocumentScreen({
  document,
  closeHref,
  notice,
}: {
  document: DocumentRow;
  closeHref: string;
  /** A refusal from "Mark as signed", which comes back through the address. */
  notice?: string;
}) {
  const supabase = await createClient();
  const path = document.file_url.trim();

  const [view, name] = await Promise.all([
    isSignablePdf(path)
      ? supabase.storage
          .from(DOCUMENTS_BUCKET)
          .createSignedUrl(path, 60 * 30)
          .then(({ data }) => data?.signedUrl ?? null)
      : Promise.resolve(null),
    signerName(supabase),
  ]);

  const signature = readSignature(document);
  // Only an ask can be declined. A row that is merely Action Needed was never
  // sent by anybody, so there is nobody to send a refusal back to.
  const asked = isWaitingOn(signature, "professional");

  return (
    <SignWorkspace
      documentId={document.id}
      title={document.title}
      eyebrow={
        asked
          ? `${document.linkedTo ?? "Your client"} asked you to sign`
          : "Waiting on your signature"
      }
      recipient="the client"
      pdfUrl={view}
      downloadUrl={path ? documentDownloadHref(document.id) : null}
      defaultName={name}
      closeHref={closeHref}
      notice={notice}
      signAction={signDocumentOnScreen}
      uploadAction={uploadSignedCopyFile}
      declineAction={asked ? declineSignature : undefined}
      paperExtra={
        <form action={resolveDocument} className="flex flex-col gap-3">
          <input type="hidden" name="document_id" value={document.id} />
          <input type="hidden" name="action" value="sign" />
          <input type="hidden" name="return_to" value={closeHref} />
          <p className="text-[13px] font-medium">Signed somewhere else?</p>
          <p className="text-[12.5px] leading-[1.5]" style={{ color: "var(--text-tertiary)" }}>
            Link to the signed copy, or leave the link empty to record the
            signature now and add the copy when it arrives.
          </p>
          <input
            name="signed_url"
            type="url"
            placeholder="https://…"
            aria-label="Link to the signed copy"
            className={`${CONTROL_UNSIZED} text-[13.5px]`}
          />
          <div className="flex justify-end">
            <Submit unsized variant="secondary" className="px-4 py-[9px] text-[13.5px]">
              Mark as signed
            </Submit>
          </div>
        </form>
      }
    />
  );
}

/** Who is signing, as they named themselves in Settings — a starting point they can retype. */
async function signerName(supabase: Awaited<ReturnType<typeof createClient>>) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return "";

  const { data } = await supabase
    .from("users")
    .select("full_name, preferred_name")
    .eq("id", user.id)
    .maybeSingle();

  return ((data?.full_name as string) || (data?.preferred_name as string) || "").trim();
}
