const STAFF_NAME = "Private Attaché";
const STAFF_INITIALS = "PA";

export function partnerCanSend(accessLevel: string | null | undefined): boolean {
  return accessLevel !== "read_only";
}

export function contactDisplayName(contact: {
  preferred_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
} | null | undefined): string {
  if (!contact) return "You";
  const preferred = contact.preferred_name?.trim();
  if (preferred) return preferred;
  const full = [contact.first_name, contact.last_name].filter(Boolean).join(" ").trim();
  return full || "You";
}

export function initialsFromName(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[parts.length - 1][0] ?? ""}`.toUpperCase();
}

export function staffDisplay() {
  return { name: STAFF_NAME, initials: STAFF_INITIALS };
}

export function messageTimestamp(iso: string, now = new Date()): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";

  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();

  if (sameDay) {
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
  }

  const sameYear = date.getFullYear() === now.getFullYear();
  if (sameYear) {
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** Which calendar day a message belongs to, for separators between them. */
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

/** Clock time inside a bubble. */
export function clockTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

/** Relative time for the list rail: "2h ago", "3d ago". */
export function relativeTime(iso: string | null | undefined, now = Date.now()) {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";

  const seconds = Math.round((now - then) / 1000);
  if (seconds < 60) return "just now";

  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;

  const weeks = Math.round(days / 7);
  if (weeks < 5) return `${weeks}w ago`;

  const months = Math.round(days / 30);
  if (months < 12) return `${months}mo ago`;

  return `${Math.round(days / 365)}y ago`;
}
