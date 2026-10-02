"use client";

import { Button } from "@/base/components/Button";

export function PublishProgramButton({
  pending,
  disabled,
  onPublish,
}: {
  pending?: boolean;
  disabled?: boolean;
  onPublish: () => void;
}) {
  return (
    <Button variant="primary" disabled={disabled || pending} onClick={onPublish}>
      {pending ? "Publishing…" : "Publish"}
    </Button>
  );
}
