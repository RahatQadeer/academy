"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/base/components/Button";
import { Input } from "@/base/components/Input";
import { sharePartnerDocument } from "@/super-admin/partner-center/partners/lib/document-actions";
import {
  AdminModal,
  AdminModalCancelButton,
} from "@/super-admin/partner-center/components/AdminModal";

const KIND_OPTIONS = [
  { value: "agreement", label: "Agreement" },
  { value: "program_terms", label: "Program Terms" },
  { value: "guideline", label: "Guideline" },
  { value: "marketing", label: "Marketing" },
  { value: "other", label: "Other" },
];

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

/** Local calendar YYYY-MM-DD — date pickers gray out days before today. */
function todayLocalYmd(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function ShareDocumentForm({
  partnerProfileId,
  onClose,
  onShared,
}: {
  partnerProfileId: string;
  onClose: () => void;
  onShared: (documentId: string) => void;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [documentKind, setDocumentKind] = useState("other");
  const [program, setProgram] = useState("");
  const [status, setStatus] = useState("current");
  const [neededAction, setNeededAction] = useState("sign_externally");
  const [effectiveDate, setEffectiveDate] = useState("");
  const [expirationDate, setExpirationDate] = useState("");
  const [version, setVersion] = useState("1");
  const [file, setFile] = useState<File | null>(null);
  const today = todayLocalYmd();
  const expirationMin =
    effectiveDate && effectiveDate > today ? effectiveDate : today;

  function submit() {
    setError(null);
    startTransition(async () => {
      if (!file) {
        setError("Choose a file to upload.");
        return;
      }
      const formData = new FormData();
      formData.set("partnerProfileId", partnerProfileId);
      formData.set("file", file);
      formData.set("title", title);
      formData.set("documentKind", documentKind);
      formData.set("program", program);
      formData.set("status", status);
      formData.set("neededAction", status === "action_needed" ? neededAction : "");
      formData.set("effectiveDate", effectiveDate);
      formData.set("expirationDate", expirationDate);
      formData.set("version", version);
      const result = await sharePartnerDocument(formData);
      if (result.error) {
        setError(result.error);
        return;
      }
      router.refresh();
      if (result.documentId) onShared(result.documentId);
      onClose();
    });
  }

  return (
    <AdminModal
      title="Share document"
      onClose={onClose}
      pending={pending}
      footer={
        <>
          <AdminModalCancelButton onClose={onClose} pending={pending} />
          <Button
            type="button"
            variant="primary"
            disabled={pending}
            onClick={() => submit()}
          >
            {pending ? "Sharing…" : "Share with partner"}
          </Button>
        </>
      }
    >
      <p className="m-0 mb-3 text-[12.5px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
        Appears in the partner&apos;s Documents library. Action Needed notifies them right away.
      </p>
      <div className="grid gap-3">
        <Input
          label="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Partner Agreement"
        />
        <label className="block text-[12.5px] font-medium" style={{ color: "var(--text-secondary)" }}>
          File
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.gif,.webp"
            className="mt-1 block w-full text-[13px]"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </label>
        <label className="block text-[12.5px] font-medium" style={{ color: "var(--text-secondary)" }}>
          Kind
          <select
            className="mt-1 w-full rounded-[6px] border px-3 py-2 text-[13.5px]"
            style={{ borderColor: "var(--border)", color: "var(--ink)" }}
            value={documentKind}
            onChange={(e) => setDocumentKind(e.target.value)}
          >
            {KIND_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-[12.5px] font-medium" style={{ color: "var(--text-secondary)" }}>
          Program
          <select
            className="mt-1 w-full rounded-[6px] border px-3 py-2 text-[13.5px]"
            style={{ borderColor: "var(--border)", color: "var(--ink)" }}
            value={program}
            onChange={(e) => setProgram(e.target.value)}
          >
            <option value="">—</option>
            <option value="academy">Academy</option>
            <option value="platform">Whitby</option>
            <option value="enterprise">Enterprise</option>
          </select>
        </label>
        <label className="block text-[12.5px] font-medium" style={{ color: "var(--text-secondary)" }}>
          Status
          <select
            className="mt-1 w-full rounded-[6px] border px-3 py-2 text-[13.5px]"
            style={{ borderColor: "var(--border)", color: "var(--ink)" }}
            value={status}
            onChange={(e) => setStatus(e.target.value)}
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
            <label className="block text-[12.5px] font-medium" style={{ color: "var(--text-secondary)" }}>
              Needed action
              <select
                className="mt-1 w-full rounded-[6px] border px-3 py-2 text-[13.5px]"
                style={{ borderColor: "var(--border)", color: "var(--ink)" }}
                value={neededAction}
                onChange={(e) => setNeededAction(e.target.value)}
              >
                {NEEDED_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>
            <p className="m-0 text-[12.5px] leading-relaxed" style={{ color: "var(--text-tertiary)" }}>
              Partner will see this as Action Needed until a signed copy is uploaded.
            </p>
          </>
        ) : null}
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Version"
            value={version}
            onChange={(e) => setVersion(e.target.value)}
          />
          <Input
            label="Effective date"
            type="date"
            min={today}
            value={effectiveDate}
            onChange={(e) => setEffectiveDate(e.target.value)}
          />
        </div>
        <Input
          label="Expiration / renewal"
          type="date"
          min={expirationMin}
          value={expirationDate}
          onChange={(e) => setExpirationDate(e.target.value)}
        />
        {error ? (
          <p className="m-0 text-[13px]" style={{ color: "var(--danger-text)" }}>
            {error}
          </p>
        ) : null}
      </div>
    </AdminModal>
  );
}
