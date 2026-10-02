"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/base/components/Button";
import { FormError } from "@/base/components/AuthControls";
import { replaceOwnDocument } from "@/partner-center/documents/lib/actions";
import { TeamModal } from "@/partner-center/team/components/TeamModal";
import { usePartnerAction } from "@/partner-center/lib/use-partner-action";

export function ReplaceDocumentModal({
  documentId,
  title,
  onClose,
}: {
  documentId: string;
  title: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const { runAction } = usePartnerAction();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSave() {
    if (!file) {
      setError("Choose a file to upload.");
      return;
    }
    setPending(true);
    setError(null);
    const formData = new FormData();
    formData.set("documentId", documentId);
    formData.set("file", file);
    const result = await runAction(() => replaceOwnDocument(formData), {
      onValidationError: setError,
      onRetry: () => void onSave(),
    });
    setPending(false);
    if (result.error) return;
    router.refresh();
    router.push(
      result.documentId
        ? `/partner-center/documents/${result.documentId}`
        : "/partner-center/documents",
    );
    onClose();
  }

  return (
    <TeamModal
      title="Update document"
      description={`Upload a new file to replace “${title}”. The previous version is kept as archived.`}
      onClose={onClose}
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="primary"
            disabled={pending}
            onClick={() => void onSave()}
          >
            {pending ? "Uploading…" : "Upload"}
          </Button>
        </>
      }
    >
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="w-full rounded-lg px-4 py-6 text-center"
        style={{ border: "1.5px dashed var(--border-strong)" }}
      >
        <div className="text-[13.5px] font-medium">
          {file ? file.name : "Choose a PDF, DOCX, or image"}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.doc,.docx,image/*"
          className="hidden"
          onChange={(event) => setFile(event.target.files?.[0] ?? null)}
        />
      </button>
      {error ? <FormError message={error} /> : null}
    </TeamModal>
  );
}
