export function authHref(
  path: "/login" | "/signup" | "/forgot-password",
  options?: { brand?: string; next?: string },
) {
  const params = new URLSearchParams();
  if (options?.brand) params.set("brand", options.brand);
  if (options?.next) params.set("next", options.next);
  const query = params.toString();
  return query ? `${path}?${query}` : path;
}

export function isAcademyNext(next?: string | null) {
  return Boolean(next && (next === "/academy" || next.startsWith("/academy/")));
}

export function isPartnerNext(next?: string | null) {
  return Boolean(next && (next === "/partner-center" || next.startsWith("/partner-center/")));
}

export function usesPartnerAuth(options?: { brand?: string | null; next?: string | null }) {
  return options?.brand === "partner" || isPartnerNext(options?.next);
}

export function partnerSignInHref() {
  return "/partner-center/signin";
}

export function partnerApplyHref() {
  return "/partner-center/apply";
}
