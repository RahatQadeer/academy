"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FormError } from "@/base/components/AuthControls";
import { Select } from "@/partner-center/components/Select";
import { uploadPartnerDocument } from "@/partner-center/documents/lib/actions";
import type { PartnerDocumentKind } from "@/partner-center/documents/types";
import { usePartnerAction } from "@/partner-center/lib/use-partner-action";

/** F46 Upload document modal — markup matches Partner Center HTML reference. */
export function UploadDocumentModal({
  existingLabels,
  onClose,
}: {
  existingLabels: string[];
  onClose: () => void;
}) {
  const router = useRouter();
  const { runAction } = usePartnerAction();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [program, setProgram] = useState("");
  const [documentKind, setDocumentKind] =
    useState<PartnerDocumentKind>("other");
  const [selected, setSelected] = useState<string[]>([]);
  const [newLabel, setNewLabel] = useState("");
  const [addingLabel, setAddingLabel] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const isTax = documentKind === "tax";

  const suggestions = [
    ...new Set([
      "Marketing",
      "Agreement",
      "2026",
      ...existingLabels,
      ...selected,
    ]),
  ];

  function toggleLabel(label: string) {
    setSelected((prev) =>
      prev.includes(label)
        ? prev.filter((item) => item !== label)
        : [...prev, label],
    );
  }

  function addNewLabel() {
    const trimmed = newLabel.trim();
    if (!trimmed) return;
    if (!selected.includes(trimmed)) {
      setSelected((prev) => [...prev, trimmed]);
    }
    setNewLabel("");
    setAddingLabel(false);
  }

  async function onUpload() {
    if (!file) {
      setError("Choose a file to upload.");
      return;
    }
    setPending(true);
    setError(null);
    const formData = new FormData();
    formData.set("file", file);
    formData.set("title", title);
    formData.set("note", note);
    formData.set("labels", isTax ? "" : selected.join(","));
    formData.set("program", program);
    formData.set("documentKind", documentKind);
    const result = await runAction(() => uploadPartnerDocument(formData), {
      onValidationError: setError,
      onRetry: () => void onUpload(),
    });
    setPending(false);
    if (result.error) return;
    router.refresh();
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6"
      style={{ background: "rgba(15,15,15,.35)" }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="upload-doc-title"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="w-full rounded-[12px] bg-white p-7 shadow-[0_12px_40px_rgba(0,0,0,.2)]"
        style={{ maxWidth: 480 }}
      >
        <h2
          id="upload-doc-title"
          className="m-0 mb-1.5 text-[16px] font-bold"
          style={{ color: "var(--ink)" }}
        >
          Upload document
        </h2>
        <p
          className="mb-5 mt-0 text-[13.5px]"
          style={{ color: "rgba(55,53,47,.6)" }}
        >
          {isTax
            ? "Tax certifications are stored as restricted records, not in the ordinary Documents library."
            : "Shared with Private Attaché staff for review."}
        </p>

        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            const dropped = event.dataTransfer.files?.[0] ?? null;
            if (dropped) setFile(dropped);
          }}
          className="mb-5 flex w-full flex-col items-center justify-center gap-2 rounded-lg px-4 py-8 text-center"
          style={{ border: "1.5px dashed var(--border-strong)" }}
        >
          <span className="text-[20px]" aria-hidden>
            📎
          </span>
          <span
            className="text-[13.5px] font-medium"
            style={{ color: "var(--ink)" }}
          >
            {file ? file.name : "Drop a file or click to browse"}
          </span>
          <span
            className="text-[12.5px]"
            style={{ color: "var(--text-tertiary)" }}
          >
            PDF, DOCX, or image up to 25MB
          </span>
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,.doc,.docx,image/*"
            className="hidden"
            onChange={(event) => {
              setFile(event.target.files?.[0] ?? null);
            }}
          />
        </button>

        <div className="flex flex-col gap-3.5">
          <label className="block">
            <span
              className="mb-1.5 block text-[13px] font-medium"
              style={{ color: "var(--ink)" }}
            >
              Title
            </span>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="e.g. Certificate of Insurance"
              maxLength={140}
              className="w-full rounded-md border px-3 py-2.5 text-[13.5px]"
              style={{
                borderColor: "var(--border)",
                background: "var(--surface-soft)",
                color: "var(--ink)",
              }}
            />
          </label>

          <div className="grid gap-3.5 sm:grid-cols-2">
            <Select
              label="Type"
              value={documentKind}
              onChange={(event) =>
                setDocumentKind(event.target.value as PartnerDocumentKind)
              }
            >
              <option value="other">Document</option>
              <option value="agreement">Agreement</option>
              <option value="program_terms">Program Terms</option>
              <option value="guideline">Guideline</option>
              <option value="marketing">Marketing</option>
              <option value="tax">Tax certification</option>
            </Select>

            <Select
              label="Program (optional)"
              value={program}
              onChange={(event) => setProgram(event.target.value)}
            >
              <option value="">None</option>
              <option value="academy">Academy</option>
              <option value="platform">Whitby</option>
              <option value="enterprise">Enterprise</option>
            </Select>
          </div>

          {!isTax ? (
            <div>
              <div
                className="mb-2 text-[13px] font-medium"
                style={{ color: "var(--ink)" }}
              >
                Labels
              </div>
              <div className="flex flex-wrap gap-2">
                {suggestions.map((label) => {
                  const on = selected.includes(label);
                  return (
                    <button
                      key={label}
                      type="button"
                      onClick={() => toggleLabel(label)}
                      className="rounded-md px-3 py-1.5 text-[13px]"
                      style={{
                        border: on
                          ? "1.5px solid var(--accent)"
                          : "1px solid var(--border)",
                        background: on
                          ? "var(--accent-tint-mid)"
                          : "transparent",
                        color: on
                          ? "var(--accent-hover)"
                          : "rgba(55,53,47,.65)",
                        fontWeight: on ? 500 : 400,
                      }}
                    >
                      {label}
                    </button>
                  );
                })}
                {addingLabel ? (
                  <div className="flex items-center gap-1.5">
                    <input
                      value={newLabel}
                      onChange={(event) => setNewLabel(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          addNewLabel();
                        }
                      }}
                      maxLength={40}
                      placeholder="Label"
                      className="w-28 rounded-md border px-2 py-1.5 text-[13px]"
                      style={{
                        borderColor: "var(--border)",
                        color: "var(--ink)",
                      }}
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={addNewLabel}
                      className="text-[12.5px] font-medium"
                      style={{ color: "var(--accent)" }}
                    >
                      Add
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setAddingLabel(true)}
                    className="rounded-md px-3 py-1.5 text-[13px]"
                    style={{
                      border: "1px dashed var(--border-strong)",
                      color: "var(--text-tertiary)",
                    }}
                  >
                    + New label
                  </button>
                )}
              </div>
            </div>
          ) : null}

          <label className="block">
            <span
              className="mb-1.5 block text-[13px] font-medium"
              style={{ color: "var(--ink)" }}
            >
              Note (optional)
            </span>
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Add context for the Private Attaché team…"
              rows={2}
              className="min-h-[44px] w-full resize-y rounded-md border px-3 py-2.5 text-[13.5px]"
              style={{
                borderColor: "var(--border)",
                background: "var(--surface-soft)",
                color: "var(--ink)",
              }}
            />
          </label>
        </div>

        {error ? (
          <div className="mt-3">
            <FormError message={error} />
          </div>
        ) : null}

        <div className="mt-6 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className="rounded-md border px-4 py-[9px] text-[13.5px] font-medium"
            style={{
              borderColor: "var(--border)",
              color: "var(--ink)",
              background: "transparent",
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void onUpload()}
            disabled={pending}
            className="rounded-md px-4 py-[9px] text-[13.5px] font-medium text-white"
            style={{ background: "var(--accent)" }}
          >
            {pending ? "Uploading…" : "Upload"}
          </button>
        </div>
      </div>
    </div>
  );
}
