/** Shared between the thread list on the server and the bubbles on the client. */

/** Which calendar day a message belongs to, for the separators between them. */
export function dayOf(iso: string) {
  return new Date(iso).toDateString();
}

export function dayLabel(iso: string) {
  const day = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  if (dayOf(iso) === today.toDateString()) return "Today";
  if (dayOf(iso) === yesterday.toDateString()) return "Yesterday";

  return day.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: day.getFullYear() === today.getFullYear() ? undefined : "numeric",
  });
}

/** The clock time inside a bubble. */
export function clockTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

/** Attachment sizes, short enough to sit inside a bubble. */
export function fileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
