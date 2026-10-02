/**
 * Quiz pass marks and assignment totals are percentages out of 100.
 * Nothing in the product accepts a score above 100.
 */

export const SCORE_PERCENT_MIN = 0;
export const SCORE_PERCENT_MAX = 100;
export const DEFAULT_PASSING_SCORE = 80;

export function clampScorePercent(
  value: number,
  fallback: number = DEFAULT_PASSING_SCORE,
): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(SCORE_PERCENT_MAX, Math.max(SCORE_PERCENT_MIN, Math.round(value)));
}

/** Accepts "80", 80, "80%" — always returns an integer 0–100. */
export function parsePassingScorePercent(
  raw: string | number | null | undefined,
  fallback: number = DEFAULT_PASSING_SCORE,
): number {
  if (typeof raw === "number") return clampScorePercent(raw, fallback);
  const cleaned = String(raw ?? "")
    .trim()
    .replace(/%/g, "");
  if (!cleaned) return fallback;
  return clampScorePercent(Number(cleaned), fallback);
}

/**
 * Controlled-input helper: keep only digits and never allow a typed value over 100.
 * Empty string is allowed while the user is clearing the field.
 */
export function sanitizeScorePercentInput(raw: string): string {
  const digits = raw.replace(/[^\d]/g, "");
  if (digits === "") return "";
  const n = Number(digits);
  if (!Number.isFinite(n)) return "";
  return String(Math.min(SCORE_PERCENT_MAX, n));
}

export function isValidScorePercent(value: number): boolean {
  return Number.isFinite(value) && value >= SCORE_PERCENT_MIN && value <= SCORE_PERCENT_MAX;
}
