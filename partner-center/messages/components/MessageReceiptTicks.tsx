import type { MessageReadStatus } from "@/partner-center/messages/lib/read-status";

/** WhatsApp-style single / double check on own bubbles. */
export function MessageReceiptTicks({
  status,
  onAccent = false,
}: {
  status: MessageReadStatus;
  /** Light ticks for accent-colored bubbles. */
  onAccent?: boolean;
}) {
  const read = status === "read";
  const color = onAccent
    ? read
      ? "#fff"
      : "rgba(255,255,255,.72)"
    : read
      ? "var(--accent)"
      : "var(--text-tertiary)";

  return (
    <span
      className="ml-0.5 inline-flex items-center"
      style={{ color }}
      aria-label={read ? "Read" : "Sent"}
      title={read ? "Read" : "Sent"}
    >
      <svg width="14" height="10" viewBox="0 0 16 11" fill="none" aria-hidden>
        <path
          d="M1 5.5 3.5 8 8.5 2"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {read ? (
          <path
            d="M5.5 5.5 8 8 14.5 1.5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ) : null}
      </svg>
    </span>
  );
}
