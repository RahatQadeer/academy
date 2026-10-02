const SESSION_PATTERNS = [
  /sign in to continue/i,
  /session.*expir/i,
  /not authenticated/i,
  /jwt expired/i,
  /invalid refresh token/i,
  /auth session missing/i,
];

export function isSessionExpiredMessage(message: string | null | undefined): boolean {
  if (!message?.trim()) return false;
  return SESSION_PATTERNS.some((pattern) => pattern.test(message));
}

/** Build a same-path URL with ?expired=1 for PartnerSessionWatcher. */
export function sessionExpiredRedirectPath(pathname: string, search = ""): string {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  params.delete("expired");
  params.set("expired", "1");
  const query = params.toString();
  return query ? `${pathname}?${query}` : `${pathname}?expired=1`;
}
