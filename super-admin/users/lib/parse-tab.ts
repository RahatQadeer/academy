export type PartnerAdminTab = "all" | "active" | "invited" | "revoked";

export function parsePartnerAdminTab(
  value: string | string[] | undefined,
): PartnerAdminTab {
  const raw = typeof value === "string" ? value : undefined;
  if (
    raw === "all" ||
    raw === "active" ||
    raw === "invited" ||
    raw === "revoked"
  ) {
    return raw;
  }
  return "all";
}
