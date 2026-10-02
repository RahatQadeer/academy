/**
 * Document vocabulary, kept clear of the server module so the dialogs can
 * import it — the same split the other modules make.
 */

export const DOCUMENT_STATUS = [
  { value: "current", label: "Current" },
  { value: "action_needed", label: "Action Needed" },
  { value: "completed", label: "Completed" },
  { value: "archived", label: "Archived" },
] as const;

/*
 * "Restricted" answered nothing a reader could act on — restricted to whom?
 *
 * The policy is the answer: `documents_select` lets a row through for the
 * person who uploaded it, the person it was shared with, and — only when the
 * visibility is not `restricted` — everyone else in the workspace. So it is
 * already "only me", and now it says so. The stored value stays `restricted`,
 * because it is written into two policies and a Postgres enum; this is the
 * word on the screen, matching what Forms was given for the same reason.
 */
export const VISIBILITY = [
  { value: "internal", label: "Internal only" },
  { value: "client_visible", label: "Client visible" },
  { value: "restricted", label: "Only me" },
] as const;

export function documentStatusLabel(value: string) {
  return DOCUMENT_STATUS.find((s) => s.value === value)?.label ?? value;
}

export function documentStatusTone(value: string) {
  switch (value) {
    case "current":
      return "success" as const;
    case "action_needed":
      return "warning" as const;
    // 21 draws Completed in the same green as Current — the work is done
    // either way, and blue said it was something else.
    case "completed":
      return "success" as const;
    default:
      return "neutral" as const;
  }
}

export function visibilityLabel(value: string) {
  return VISIBILITY.find((v) => v.value === value)?.label ?? value;
}

/** 12.2's preset chips — togglable labels, not a comma field. */
export const DOCUMENT_LABEL_PRESETS = [
  "Agreement",
  "Housing",
  "Providers",
  "Tax",
] as const;

export const DOCUMENT_FILE_ACCEPT = ".pdf,.docx,.xlsx,.png,.jpg,.jpeg";

const DOCUMENT_FILE_EXTENSIONS = DOCUMENT_FILE_ACCEPT.split(",");

export function documentDownloadHref(documentId: string) {
  return `/api/whitbyos/documents/${documentId}/download`;
}

/** A Gmail/Outlook window is not a file — Download used to navigate there. */
export function isInboxLink(value: string) {
  const text = value.trim();
  if (!text) return false;
  if (/^mailto:/i.test(text)) return true;
  try {
    const url = new URL(text);
    if (url.protocol !== "http:" && url.protocol !== "https:") return false;
    const host = url.hostname.replace(/^www\./i, "").toLowerCase();
    if (host === "mail.google.com" || host === "gmail.com") return true;
    if (host === "google.com" && url.pathname.toLowerCase().startsWith("/gmail")) return true;
    if (
      host === "outlook.live.com" ||
      host === "outlook.office.com" ||
      host === "outlook.office365.com"
    ) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

export function isAllowedDocumentFile(file: { name: string; type?: string }) {
  const name = file.name.toLowerCase();
  if (DOCUMENT_FILE_EXTENSIONS.some((ext) => name.endsWith(ext))) return true;
  const type = (file.type ?? "").toLowerCase();
  return (
    type === "application/pdf" ||
    type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    type === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    type === "image/png" ||
    type === "image/jpeg"
  );
}
