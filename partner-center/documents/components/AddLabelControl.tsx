"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/base/components/Button";
import { Input } from "@/base/components/Input";
import { FormError } from "@/base/components/AuthControls";
import { addDocumentLabel } from "@/partner-center/documents/lib/actions";
import { TeamModal } from "@/partner-center/team/components/TeamModal";

export function AddLabelControl({
  documentId,
  canMutate,
}: {
  documentId: string;
  canMutate: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  if (!canMutate) return null;

  async function onSave() {
    setPending(true);
    setError(null);
    try {
      const result = await addDocumentLabel({ documentId, label });
      if (result.error) {
        setError(result.error);
        return;
      }
      setOpen(false);
      setLabel("");
      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Could not add the label.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded px-2 py-0.5 text-[10.5px] font-medium"
        style={{
          border: "1px dashed var(--border-strong)",
          color: "rgba(55,53,47,.5)",
          background: "transparent",
        }}
      >
        + Add label
      </button>
      {open ? (
        <TeamModal
          title="Add label"
          description="Labels are organizational only — they never change permissions or terms."
          onClose={() => setOpen(false)}
          footer={
            <>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button
                type="button"
                variant="primary"
                disabled={pending || !label.trim()}
                onClick={() => void onSave()}
              >
                {pending ? "Saving…" : "Add"}
              </Button>
            </>
          }
        >
          <Input
            label="Label"
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            maxLength={40}
            placeholder="e.g. Agreement, 2026"
            autoFocus
          />
          {error ? <FormError message={error} /> : null}
        </TeamModal>
      ) : null}
    </>
  );
}
