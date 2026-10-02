import { Button } from "@/base/components/Button";

export type SaveState = "saved" | "unsaved" | "saving" | "error";

function statusDot(state: SaveState) {
  if (state === "error") return "var(--danger-fg)";
  if (state === "unsaved" || state === "saving") return "var(--warning-fg)";
  return "var(--success-fg)";
}

export function SaveDraftBar({
  state,
  message,
  disabled,
  onSave,
  previewHref,
}: {
  state: SaveState;
  message?: string;
  disabled?: boolean;
  onSave: () => void;
  previewHref: string;
}) {
  const label =
    state === "saving"
      ? "Saving…"
      : state === "saved"
        ? "Saved"
        : state === "error"
          ? "Could not save"
          : "Unsaved changes";

  return (
    <div className="flex flex-wrap items-center gap-2.5">
      <p
        className="inline-flex items-center gap-1.5 text-[12.5px] font-medium"
        style={{ color: state === "error" ? "var(--danger-fg)" : "var(--text-secondary)" }}
      >
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: statusDot(state) }} />
        {message || label}
      </p>
      <Button href={previewHref} variant="secondary">
        Preview
      </Button>
      <Button variant="primary" disabled={disabled || state === "saving"} onClick={onSave}>
        {state === "saving" ? "Saving…" : "Save draft"}
      </Button>
    </div>
  );
}
