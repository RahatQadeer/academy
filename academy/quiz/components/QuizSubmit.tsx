export function QuizSubmit({
  disabled,
  pending,
}: {
  disabled: boolean;
  pending: boolean;
}) {
  return (
    <button
      type="submit"
      disabled={disabled || pending}
      className="inline-flex items-center justify-center rounded-[6px] px-4 py-[9px] text-[13.5px]"
      style={{
        background: "var(--accent)",
        color: "#fff",
        border: 0,
        opacity: disabled || pending ? 0.55 : 1,
        cursor: disabled || pending ? "not-allowed" : "pointer",
      }}
    >
      {pending ? "Submitting…" : "Submit quiz"}
    </button>
  );
}
