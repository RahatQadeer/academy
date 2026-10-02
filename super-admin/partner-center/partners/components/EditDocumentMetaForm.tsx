"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/base/components/Button";
import { Input } from "@/base/components/Input";
import { Pill } from "@/base/components/Pill";
import { documentStatusTone } from "@/partner-center/documents/lib/format";
import { AdminDetailSection } from "@/super-admin/partner-center/components/AdminDetailSections";
import { AdminFileDropzone } from "@/super-admin/partner-center/partners/components/AdminFileDropzone";
import type { AdminPartnerDocumentRow } from "@/super-admin/partner-center/partners/lib/load-partner-documents";
import {
  createAmendment,
  sendForExternalSignature,
  updatePartnerDocumentMeta,
  uploadSignedCopyAsAdmin,
} from "@/super-admin/partner-center/partners/lib/document-actions";
import {
  PC_ADMIN,
  type PartnerDocumentSection,
} from "@/super-admin/partner-center/lib/paths";

const KIND_OPTIONS = [
  { value: "agreement", label: "Agreement" },
  { value: "program_terms", label: "Program Terms" },
  { value: "guideline", label: "Guideline" },
  { value: "marketing", label: "Marketing" },
  { value: "other", label: "Other" },
];

/** Local calendar YYYY-MM-DD — date pickers gray out days before today. */
function todayLocalYmd(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

const STATUS_OPTIONS = [
  { value: "current", label: "Current" },
  { value: "action_needed", label: "Action Needed" },
  { value: "completed", label: "Completed" },
  { value: "archived", label: "Archived" },
];

const NEEDED_OPTIONS = [
  { value: "review", label: "Review" },
  { value: "sign_externally", label: "Sign" },
  { value: "upload", label: "Upload" },
  { value: "update", label: "Update" },
];

export function EditDocumentMetaForm({
  partnerProfileId,
  document,
  supersedeOptions,
  allTitles,
  section,
}: {
  partnerProfileId: string;
  document: AdminPartnerDocumentRow;
  supersedeOptions: { id: string; title: string }[];
  allTitles: { id: string; title: string }[];
  section: PartnerDocumentSection;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [title, setTitle] = useState(document.title);
  const [documentKind, setDocumentKind] = useState(document.documentKind);
  const [program, setProgram] = useState(document.program ?? "");
  const [status, setStatus] = useState(document.status);
  const [neededAction, setNeededAction] = useState(
    document.neededAction ?? "sign_externally",
  );
  const [version, setVersion] = useState(String(document.version));
  const [effectiveDate, setEffectiveDate] = useState(document.effectiveDate ?? "");
  const [signedDate, setSignedDate] = useState(document.signedDate ?? "");
  const [expirationDate, setExpirationDate] = useState(
    document.expirationDate ?? "",
  );
  const [externalSignatureRef, setExternalSignatureRef] = useState(
    document.externalSignatureRef ?? "",
  );
  const [supersededByDocumentId, setSupersededByDocumentId] = useState(
    document.supersededByDocumentId ?? "",
  );

  const [sendFile, setSendFile] = useState<File | null>(null);
  const [signedFile, setSignedFile] = useState<File | null>(null);
  const [amendFile, setAmendFile] = useState<File | null>(null);

  const today = todayLocalYmd();
  const expirationMin =
    effectiveDate && effectiveDate > today ? effectiveDate : today;

  const isLocked =
    document.status === "archived" || Boolean(document.supersededByDocumentId);
  const awaitingSignature =
    document.status === "action_needed" &&
    (document.neededAction === "sign_externally" ||
      document.neededAction === "upload" ||
      document.neededAction === "update");
  const canSendForSignature = !isLocked && !pending;
  const canUploadSigned = !isLocked && awaitingSignature && Boolean(signedFile) && !pending;
  const canAmend =
    !isLocked &&
    (document.status === "current" || document.status === "completed") &&
    Boolean(amendFile) &&
    !pending;

  const successor = allTitles.find(
    (opt) => opt.id === document.supersededByDocumentId,
  );

  function saveMeta() {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const formData = new FormData();
      formData.set("partnerProfileId", partnerProfileId);
      formData.set("documentId", document.id);
      formData.set("title", title);
      formData.set("documentKind", documentKind);
      formData.set("program", program);
      formData.set("status", status);
      formData.set(
        "neededAction",
        status === "action_needed" ? neededAction || "" : "",
      );
      formData.set("version", version);
      formData.set("effectiveDate", effectiveDate);
      formData.set("signedDate", signedDate);
      formData.set("expirationDate", expirationDate);
      formData.set("externalSignatureRef", externalSignatureRef);
      formData.set("supersededByDocumentId", supersededByDocumentId);
      const result = await updatePartnerDocumentMeta(formData);
      if (result.error) {
        setError(result.error);
        return;
      }
      setMessage("Saved.");
      router.refresh();
    });
  }

  function sendForSignature() {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const formData = new FormData();
      formData.set("partnerProfileId", partnerProfileId);
      formData.set("documentId", document.id);
      if (sendFile) formData.set("file", sendFile);
      const result = await sendForExternalSignature(formData);
      if (result.error) {
        setError(result.error);
        return;
      }
      setSendFile(null);
      setMessage("Sent for signature. Partner can sign in Partner Center now.");
      router.refresh();
      router.push(
        PC_ADMIN.partnerDocument(partnerProfileId, document.id, "signature"),
      );
    });
  }

  function uploadSigned() {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      if (!signedFile) {
        setError("Choose the signed file to upload.");
        return;
      }
      const formData = new FormData();
      formData.set("partnerProfileId", partnerProfileId);
      formData.set("documentId", document.id);
      formData.set("file", signedFile);
      formData.set("externalSignatureRef", externalSignatureRef);
      const result = await uploadSignedCopyAsAdmin(formData);
      if (result.error) {
        setError(result.error);
        return;
      }
      setMessage("Signed copy saved. This version is now archived.");
      if (result.documentId) {
        router.push(
          PC_ADMIN.partnerDocument(partnerProfileId, result.documentId, "metadata"),
        );
        router.refresh();
        return;
      }
      router.refresh();
    });
  }

  function uploadAmendment() {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      if (!amendFile) {
        setError("Choose the amendment file.");
        return;
      }
      const formData = new FormData();
      formData.set("partnerProfileId", partnerProfileId);
      formData.set("priorDocumentId", document.id);
      formData.set("file", amendFile);
      formData.set("title", `${title} (amendment)`);
      formData.set("effectiveDate", effectiveDate);
      formData.set("status", "current");
      const result = await createAmendment(formData);
      if (result.error) {
        setError(result.error);
        return;
      }
      setMessage("Amendment saved. Prior version archived.");
      if (result.documentId) {
        router.push(
          PC_ADMIN.partnerDocument(partnerProfileId, result.documentId, "metadata"),
        );
        router.refresh();
        return;
      }
      router.refresh();
    });
  }

  const selectClass =
    "mt-1 w-full rounded-[6px] border px-3 py-2 text-[13.5px]";
  const selectStyle = { borderColor: "var(--border)", color: "var(--ink)" };

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-center gap-2">
        <Pill tone={documentStatusTone(document.status)}>
          {document.statusLabel}
        </Pill>
        <span className="text-[12.5px]" style={{ color: "var(--text-secondary)" }}>
          v{document.version}
          {document.neededAction
            ? ` · ${document.neededAction.replace(/_/g, " ")}`
            : ""}
        </span>
      </div>

      {isLocked ? (
        <div
          className="rounded-[8px] px-4 py-3 text-[13px] leading-relaxed"
          style={{
            background: "var(--surface-soft)",
            color: "var(--text-secondary)",
            border: "1px solid var(--border)",
          }}
        >
          This version was archived when a signed copy or amendment replaced it
          (status stays v{document.version} on the old row).{" "}
          {document.supersededByDocumentId ? (
            <>
              Open the successor{" "}
              <Link
                href={PC_ADMIN.partnerDocument(
                  partnerProfileId,
                  document.supersededByDocumentId,
                  "metadata",
                )}
                className="font-medium"
                style={{ color: "var(--accent)" }}
              >
                {successor?.title ?? "newer version"}
              </Link>
              .
            </>
          ) : (
            "Open the Completed / Current row in the list to continue."
          )}
        </div>
      ) : null}

      {section === "metadata" ? (
        <AdminDetailSection title="Version & legal metadata" variant="form">
          <div className="grid gap-3">
            <Input
              label="Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <label
              className="block text-[12.5px] font-medium"
              style={{ color: "var(--text-secondary)" }}
            >
              Kind
              <select
                className={selectClass}
                style={selectStyle}
                value={documentKind}
                onChange={(e) =>
                  setDocumentKind(e.target.value as typeof documentKind)
                }
              >
                {KIND_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>
            <label
              className="block text-[12.5px] font-medium"
              style={{ color: "var(--text-secondary)" }}
            >
              Program
              <select
                className={selectClass}
                style={selectStyle}
                value={program}
                onChange={(e) => setProgram(e.target.value)}
              >
                <option value="">—</option>
                <option value="academy">Academy</option>
                <option value="platform">Whitby</option>
                <option value="enterprise">Enterprise</option>
              </select>
            </label>
            <label
              className="block text-[12.5px] font-medium"
              style={{ color: "var(--text-secondary)" }}
            >
              Status
              <select
                className={selectClass}
                style={selectStyle}
                value={status}
                onChange={(e) => setStatus(e.target.value as typeof status)}
                disabled={isLocked}
              >
                {STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>
            {status === "action_needed" ? (
              <>
                <label
                  className="block text-[12.5px] font-medium"
                  style={{ color: "var(--text-secondary)" }}
                >
                  Needed action
                  <select
                    className={selectClass}
                    style={selectStyle}
                    value={neededAction || "review"}
                    onChange={(e) =>
                      setNeededAction(
                        e.target.value as NonNullable<typeof neededAction>,
                      )
                    }
                    disabled={isLocked}
                  >
                    {NEEDED_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </label>
                <p
                  className="m-0 text-[12.5px] leading-relaxed"
                  style={{ color: "var(--text-tertiary)" }}
                >
                  Partner will see this as Action Needed until a signed copy is
                  uploaded.
                </p>
              </>
            ) : null}
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Version"
                value={version}
                onChange={(e) => setVersion(e.target.value)}
                hint="Bumps automatically on signed copy / amendment; edit only for corrections."
              />
              <Input
                label="Effective date"
                type="date"
                min={today}
                value={effectiveDate}
                onChange={(e) => setEffectiveDate(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Signed / accepted date"
                type="date"
                value={signedDate}
                onChange={(e) => setSignedDate(e.target.value)}
              />
              <Input
                label="Expiration / renewal"
                type="date"
                min={expirationMin}
                value={expirationDate}
                onChange={(e) => setExpirationDate(e.target.value)}
              />
            </div>
            <Input
              label="Signature / reference"
              value={externalSignatureRef}
              onChange={(e) => setExternalSignatureRef(e.target.value)}
              placeholder="Envelope ID or note"
            />
            <label
              className="block text-[12.5px] font-medium"
              style={{ color: "var(--text-secondary)" }}
            >
              Superseded by
              <select
                className={selectClass}
                style={selectStyle}
                value={supersededByDocumentId}
                onChange={(e) => setSupersededByDocumentId(e.target.value)}
                disabled={isLocked}
              >
                <option value="">—</option>
                {supersedeOptions
                  .filter((opt) => opt.id !== document.id)
                  .map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      {opt.title}
                    </option>
                  ))}
              </select>
            </label>
            <div className="flex flex-wrap gap-2 pt-1">
              <Button
                type="button"
                variant="primary"
                disabled={pending}
                onClick={() => saveMeta()}
              >
                {pending ? "Saving…" : "Save metadata"}
              </Button>
            </div>
          </div>
        </AdminDetailSection>
      ) : null}

      {section === "signature" ? (
        <div className="grid gap-5">
          <AdminDetailSection title="Send for signature" variant="form">
            <p
              className="m-0 mb-3 text-[12.5px] leading-relaxed"
              style={{ color: "var(--text-secondary)" }}
            >
              Sets status to Action Needed → Sign. The partner can sign in
              Partner Center (on screen for PDFs, or Sign on paper). Attach an
              unsigned file only if you need to replace what they download.
            </p>
            {awaitingSignature ? (
              <p
                className="m-0 mb-3 text-[12.5px]"
                style={{ color: "var(--text-tertiary)" }}
              >
                Already awaiting signature. Re-send only if you need to refresh
                the unsigned file.
              </p>
            ) : null}
            <div className="mb-3">
              <AdminFileDropzone
                file={sendFile}
                onFile={setSendFile}
                disabled={!canSendForSignature}
                label="Optional: attach unsigned PDF"
              />
            </div>
            <Button
              type="button"
              variant="primary"
              disabled={!canSendForSignature}
              onClick={() => sendForSignature()}
            >
              {pending ? "Sending…" : "Send for signature"}
            </Button>
          </AdminDetailSection>

          <AdminDetailSection title="Upload signed copy" variant="form">
            <p
              className="m-0 mb-3 text-[12.5px] leading-relaxed"
              style={{ color: "var(--text-secondary)" }}
            >
              Available after the doc is Action Needed for signature. Archives
              this version and creates v{document.version + 1}. Use if staff
              already have the signed file.
            </p>
            {!awaitingSignature && !isLocked ? (
              <p
                className="m-0 mb-3 text-[12.5px]"
                style={{ color: "var(--text-tertiary)" }}
              >
                Send for signature first (or set status to Action Needed → Sign
                on Metadata).
              </p>
            ) : null}
            <div className="mb-3">
              <AdminFileDropzone
                file={signedFile}
                onFile={setSignedFile}
                disabled={isLocked || !awaitingSignature || pending}
                label="Choose signed PDF"
              />
            </div>
            <Input
              label="Signature / reference"
              value={externalSignatureRef}
              onChange={(e) => setExternalSignatureRef(e.target.value)}
              placeholder="Envelope ID or note"
            />
            <div className="mt-3">
              <Button
                type="button"
                variant="primary"
                disabled={!canUploadSigned}
                onClick={() => uploadSigned()}
              >
                {pending ? "Uploading…" : "Upload signed copy"}
              </Button>
            </div>
          </AdminDetailSection>
        </div>
      ) : null}

      {section === "amendment" ? (
        <AdminDetailSection title="Amendment" variant="form">
          <p
            className="m-0 mb-3 text-[12.5px] leading-relaxed"
            style={{ color: "var(--text-secondary)" }}
          >
            Upload a new version that supersedes this document. Prior row is
            archived and linked. Use when the current/completed doc needs a new
            version (not the in-flight signature path).
          </p>
          <div className="mb-3">
            <AdminFileDropzone
              file={amendFile}
              onFile={setAmendFile}
              disabled={
                isLocked ||
                !(document.status === "current" || document.status === "completed") ||
                pending
              }
              label="Choose amendment file"
            />
          </div>
          <Button
            type="button"
            variant="primary"
            disabled={!canAmend}
            onClick={() => uploadAmendment()}
          >
            {pending ? "Uploading…" : "Upload amendment"}
          </Button>
        </AdminDetailSection>
      ) : null}

      {error ? (
        <p className="m-0 text-[13px]" style={{ color: "var(--danger-text)" }}>
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="m-0 text-[13px]" style={{ color: "var(--success-fg)" }}>
          {message}
        </p>
      ) : null}
    </div>
  );
}
