/**
 * What 3.3x offers for a Request's status.
 *
 * The column is free text and has held "open" since the first Requests were
 * written, so that is read as Not Started rather than migrated away: a status
 * nobody has chosen yet is exactly what Not Started means, and rewriting rows
 * to say the same thing in a new word buys nothing.
 */
export const REQUEST_STATUSES = [
  { value: "not_started", label: "Not Started" },
  { value: "running", label: "Running" },
  { value: "waiting_on_client", label: "Waiting on Client" },
  { value: "completed", label: "Completed" },
] as const;

export const REQUEST_STATUS_VALUES = new Set(REQUEST_STATUSES.map((row) => row.value));

/**
 * Statuses that still count as open work.
 *
 * 3.3x is the vocabulary (not_started / running / waiting_on_client). Older
 * rows may still say "open", and a few early list pills used approval / at_risk
 * / manual — those stay here so an old row does not vanish from Active Requests.
 */
export const OPEN_REQUEST_STATUSES = [
  "open",
  "not_started",
  "running",
  "waiting_on_client",
  "approval",
  "at_risk",
  "manual",
];

/** "open" is the old spelling of not_started, and there are rows in it. */
export function requestStatusValue(status: string | null | undefined) {
  const value = (status ?? "").trim();
  if (!value || value === "open") return "not_started";
  return REQUEST_STATUS_VALUES.has(value as never) ? value : "not_started";
}

export function requestStatusLabel(status: string | null | undefined) {
  const value = requestStatusValue(status);
  return REQUEST_STATUSES.find((row) => row.value === value)?.label ?? "Not Started";
}

/**
 * The pill colour 4.4 and 5.1 give a request beside its name.
 *
 * Completed is the only settled one, so it is the only green; running is in
 * hand, waiting is on somebody else, and not started is not yet a fact about
 * anything.
 */
export function requestStatusTone(status: string | null | undefined) {
  switch (requestStatusValue(status)) {
    case "completed":
      return "success" as const;
    case "running":
      return "info" as const;
    case "waiting_on_client":
      return "warning" as const;
    default:
      return "neutral" as const;
  }
}
