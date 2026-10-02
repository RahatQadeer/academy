/**
 * Partner-facing error copy. Never surface raw Postgres/Supabase jargon.
 * Prefer a known mapped phrase; otherwise the provided fallback.
 */
export function partnerFacingError(
  fallback: string,
  raw?: string | null,
): string {
  const message = (raw ?? "").trim();
  if (!message) return fallback;

  const lower = message.toLowerCase();

  if (
    /jwt|session|not authenticated|invalid refresh|auth session missing/.test(
      lower,
    )
  ) {
    return "Your session expired. Sign in again to continue.";
  }
  if (/permission|rls|row-level|not authorized|forbidden|42501/.test(lower)) {
    return "You do not have permission to do that.";
  }
  if (/duplicate key|unique constraint|23505/.test(lower)) {
    return "That record already exists. Refresh and try again.";
  }
  if (/foreign key|23503|violates/.test(lower)) {
    return "This change could not be saved because related information is missing.";
  }
  if (/network|fetch failed|failed to fetch|timeout|econnrefused/.test(lower)) {
    return "Connection issue. Check your network and try again.";
  }
  if (/schema cache|does not exist|relation .* does not exist|pgrst/.test(lower)) {
    return "Something is temporarily unavailable. Try again in a moment.";
  }
  if (/rate limit|too many requests|429/.test(lower)) {
    return "Too many attempts. Wait a moment and try again.";
  }

  // Already plain language (no tech markers) — allow through.
  if (
    !/[_.]|supabase|postgres|sql|stack|uuid|null value|column |table /i.test(
      message,
    ) &&
    message.length < 160 &&
    !/^\w+Error:/.test(message)
  ) {
    return message;
  }

  return fallback;
}
