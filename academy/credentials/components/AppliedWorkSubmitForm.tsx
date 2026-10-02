"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/base/components/Button";
import { submitAppliedWorkAction } from "../actions";
import type { CredentialAssignmentSlot } from "../types/detail";

export function AppliedWorkSubmitForm({
  credentialId,
  programName,
  slot,
}: {
  credentialId: string;
  programName: string;
  slot: CredentialAssignmentSlot;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [summary, setSummary] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    startTransition(async () => {
      const formData = new FormData();
      formData.set("credentialId", credentialId);
      formData.set("lessonId", slot.lessonId);
      formData.set("summary", summary);
      if (file) formData.set("document", file);

      const result = await submitAppliedWorkAction(formData);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      router.push(
        `/academy/credentials/${credentialId}/submitted?n=${slot.index}&total=${slot.total}&program=${encodeURIComponent(programName)}`,
      );
    });
  }

  return (
    <div className="mx-auto max-w-2xl">
      <Link
        href={`/academy/credentials/${credentialId}`}
        className="text-[13.5px] no-underline hover:text-accent-hover"
        style={{ color: "var(--accent)" }}
      >
        ← {programName}
      </Link>

      <h1 className="mt-4 text-[24px] font-medium leading-tight">
        Submit — Applied Work & Submissions
      </h1>
      <p className="mt-2 text-[14px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
        Submission {slot.index} of {slot.total}. {slot.brief} Reviewed by an Academy Admin,
        typically within 5 business days.
      </p>

      <form onSubmit={onSubmit} className="mt-8 space-y-6">
        <label className="block">
          <span className="text-[13.5px] font-medium">Summary</span>
          <textarea
            value={summary}
            onChange={(event) => setSummary(event.target.value)}
            rows={6}
            required
            placeholder="Describe the engagement, the client's situation, and how you scoped the deliverables..."
            className="mt-2 w-full rounded-[8px] px-3 py-2.5 text-[14px] leading-relaxed"
            style={{
              border: "1px solid var(--border-strong)",
              background: "var(--surface)",
              color: "var(--ink)",
            }}
          />
        </label>

        <div>
          <p className="text-[13.5px] font-medium">Supporting document (optional)</p>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="mt-2 flex w-full flex-col items-center justify-center rounded-[8px] px-4 py-8 text-[13.5px]"
            style={{
              border: "1px dashed var(--border-dashed)",
              color: "var(--text-secondary)",
              background: "transparent",
            }}
          >
            {file ? file.name : (
              <>
                Drop a file or{" "}
                <span style={{ color: "var(--accent)" }}>browse</span>
              </>
            )}
          </button>
          <input
            ref={fileRef}
            type="file"
            className="hidden"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          />
        </div>

        {error ? (
          <p className="text-[13px]" style={{ color: "var(--danger-fg, #c0392b)" }}>
            {error}
          </p>
        ) : null}

        <div className="flex justify-end gap-3">
          <Button href={`/academy/credentials/${credentialId}`} variant="secondary">
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={pending || !summary.trim()}>
            {pending ? "Submitting…" : "Submit"}
          </Button>
        </div>
      </form>
    </div>
  );
}
