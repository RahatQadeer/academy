"use client";

import { useState } from "react";
import { Button } from "@/base/components/Button";
import { Input } from "@/base/components/Input";
import { FormError } from "@/base/components/AuthControls";
import { renameDocumentLabel } from "@/partner-center/documents/lib/actions";
import { TeamModal } from "@/partner-center/team/components/TeamModal";

export function RenameLabelModal({
  from,
  onClose,
  onDone,
}: {
  from: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [to, setTo] = useState(from);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSave() {
    setPending(true);
    setError(null);
    try {
      const result = await renameDocumentLabel({ from, to });
      if (result.error) {
        setError(result.error);
        return;
      }
      onDone();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Could not rename the label.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <TeamModal
      title="Rename label"
      description={`Update “${from}” on every document that uses it. Labels are organizational only.`}
      onClose={onClose}
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="primary"
            disabled={pending || !to.trim()}
            onClick={onSave}
          >
            {pending ? "Saving…" : "Save"}
          </Button>
        </>
      }
    >
      <Input
        label="New name"
        value={to}
        onChange={(event) => setTo(event.target.value)}
        maxLength={40}
        autoFocus
      />
      {error ? <FormError message={error} /> : null}
    </TeamModal>
  );
}
