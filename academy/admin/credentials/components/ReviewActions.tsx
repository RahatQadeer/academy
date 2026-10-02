"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/base/components/Button";
import { awardCredentialAction, returnCredentialAction } from "../actions";
import { REVIEW_NOTES_MAX } from "../types";

export function ReviewActions({ credentialId }: { credentialId: string }) {
  const router = useRouter();
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const trimmed = notes.trim();

  function award() {
    startTransition(async () => {
      setError(null);
      const result = await awardCredentialAction(credentialId, trimmed);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      router.push(`/academy/admin/credentials/${credentialId}/awarded`);
    });
  }

  function sendBack() {
    if (!trimmed) {
      setError("Write what the learner should change, then send it back.");
      return;
    }
    startTransition(async () => {
      setError(null);
      const result = await returnCredentialAction(credentialId, trimmed);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      router.push("/academy/admin/credentials");
    });
  }

  return (
    <section
      className="overflow-hidden rounded-[12px] bg-white"
      style={{ border: "1px solid var(--border)" }}
    >
      <div
        className="border-b px-5 py-4"
        style={{
          borderColor: "var(--border)",
          background: "color-mix(in srgb, var(--accent-tint) 45%, var(--surface))",
        }}
      >
        <h3
          className="text-[14.5px] font-semibold tracking-[-0.2px]"
          style={{ color: "var(--ink)" }}
        >
          Decision
        </h3>
        <p className="mt-1 text-[13px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
          Optional note on award appears on the learner’s certificate page. A note is required when
          sending back.
        </p>
      </div>

      <div className="px-5 py-4">
        <label className="block">
          <span
            className="mb-1.5 block text-[12px] font-medium"
            style={{ color: "var(--text-tertiary)" }}
          >
            Reviewer note
          </span>
          <textarea
            value={notes}
            maxLength={REVIEW_NOTES_MAX}
            rows={4}
            disabled={pending}
            placeholder="Optional on award · required when sending back"
            className="w-full resize-y rounded-[8px] border bg-white px-3 py-2.5 text-[14px] leading-relaxed outline-none transition-[border-color,box-shadow] focus:border-[var(--accent)] focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--accent)_18%,transparent)]"
            style={{ borderColor: "var(--border-strong)", color: "var(--ink)" }}
            onChange={(event) => setNotes(event.target.value)}
          />
        </label>
        <p className="mt-1.5 text-right text-[11.5px] tabular-nums" style={{ color: "var(--text-tertiary)" }}>
          {trimmed.length}/{REVIEW_NOTES_MAX}
        </p>

        {error ? (
          <p
            className="mt-2 rounded-[7px] px-3 py-2 text-[13px]"
            style={{
              color: "var(--danger-fg)",
              background: "var(--danger-bg)",
            }}
          >
            {error}
          </p>
        ) : null}

        <div className="mt-4 flex flex-col gap-2">
          <Button variant="primary" disabled={pending} onClick={award}>
            {pending ? "Saving…" : "Award credential"}
          </Button>
          <Button variant="secondary" disabled={pending} onClick={sendBack}>
            Send back with this note
          </Button>
        </div>
      </div>
    </section>
  );
}
