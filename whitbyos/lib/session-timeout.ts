export const SESSION_TIMEOUT_KEY = "pa-session-timeout-minutes";
export const SESSION_TIMEOUT_EVENT = "pa-session-timeout-changed";

export const SESSION_TIMEOUT_OPTIONS = [
  { value: 15, label: "15 minutes" },
  { value: 30, label: "30 minutes" },
  { value: 60, label: "1 hour" },
  { value: 240, label: "4 hours" },
  { value: 0, label: "Never" },
] as const;

export type SessionTimeoutMinutes = (typeof SESSION_TIMEOUT_OPTIONS)[number]["value"];

export function parseSessionTimeout(raw: string | null | undefined): SessionTimeoutMinutes {
  const n = Number(raw);
  const match = SESSION_TIMEOUT_OPTIONS.find((option) => option.value === n);
  return match ? match.value : 0;
}

export function readSessionTimeout(): SessionTimeoutMinutes {
  if (typeof window === "undefined") return 0;
  return parseSessionTimeout(window.localStorage.getItem(SESSION_TIMEOUT_KEY));
}

export function writeSessionTimeout(minutes: SessionTimeoutMinutes) {
  window.localStorage.setItem(SESSION_TIMEOUT_KEY, String(minutes));
  window.dispatchEvent(new Event(SESSION_TIMEOUT_EVENT));
}
