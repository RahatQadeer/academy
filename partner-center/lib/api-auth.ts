import "server-only";

export function verifyPartnerApiSecret(
  request: Request,
  envKey: "PARTNER_ATTRIBUTION_SECRET" | "PARTNER_PAYOUT_SECRET",
): boolean {
  const primary = process.env[envKey]?.trim();
  const fallback =
    envKey === "PARTNER_PAYOUT_SECRET"
      ? process.env.PARTNER_ATTRIBUTION_SECRET?.trim()
      : undefined;
  const secret = primary || fallback;
  if (!secret) return false;
  const header = request.headers.get("authorization")?.trim();
  return header === `Bearer ${secret}`;
}
