import { SignWorkspace } from "@/base/components/signing/SignWorkspace";
import { isSignablePdf } from "@/base/lib/signing/placement";
import { createClient } from "@/base/lib/supabase/server";
import {
  signPartnerDocumentOnScreen,
  uploadPartnerSignedCopy,
} from "@/partner-center/documents/lib/signing-actions";

/**
 * Full-screen partner signer — shared SignWorkspace with Partner filing actions.
 */
export async function PartnerSignDocumentScreen({
  documentId,
  title,
  fileUrl,
  closeHref,
  defaultName,
}: {
  documentId: string;
  title: string;
  fileUrl: string;
  closeHref: string;
  defaultName: string;
}) {
  const path = fileUrl.trim();
  const supabase = await createClient();

  const [view, download] = await Promise.all([
    isSignablePdf(path) && !path.startsWith("/") && !/^https?:\/\//i.test(path)
      ? supabase.storage
          .from("documents")
          .createSignedUrl(path, 60 * 30)
          .then(({ data }) => data?.signedUrl ?? null)
      : Promise.resolve(null),
    path.startsWith("/") || /^https?:\/\//i.test(path)
      ? Promise.resolve(path)
      : supabase.storage
          .from("documents")
          .createSignedUrl(path, 60 * 30, { download: true })
          .then(({ data }) => data?.signedUrl ?? null),
  ]);

  return (
    <SignWorkspace
      documentId={documentId}
      title={title}
      eyebrow="Private Attaché asked you to sign"
      recipient="Private Attaché"
      pdfUrl={view}
      downloadUrl={download}
      defaultName={defaultName}
      closeHref={closeHref}
      signAction={signPartnerDocumentOnScreen}
      uploadAction={uploadPartnerSignedCopy}
    />
  );
}
