import { Button } from "@/base/components/Button";

export type QuizSaveState = "saved" | "unsaved" | "saving" | "error";

export function QuizSaveBar({
  state,
  message,
  disabled,
  onSave,
}: {
  state: QuizSaveState;
  message?: string;
  disabled?: boolean;
  onSave: () => void;
}) {
  const label =
    state === "saving"
      ? "Saving"
      : state === "saved"
        ? "Saved"
        : state === "error"
          ? "Error"
          : "Unsaved changes";

  return (
    <div
      className="flex flex-col gap-3 rounded-[10px] bg-surface px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
      style={{ border: "1px solid var(--border)" }}
    >
      <p className="text-[13px]" style={{ color: state === "error" ? "var(--danger-fg)" : "var(--text-secondary)" }}>
        {message || label}
      </p>
      <Button variant="primary" disabled={disabled || state === "saving"} onClick={onSave}>
        {state === "saving" ? "Saving…" : "Save Draft"}
      </Button>
    </div>
  );
}
