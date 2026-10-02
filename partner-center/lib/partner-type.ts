import { parseApplicationData } from "@/partner-center/lib/application-map";
import type { PartnerProfile } from "@/partner-center/types/partner";

/** True when the partner applied / is stored as an individual (not a company). */
export function isIndividualPartner(
  profile: Pick<PartnerProfile, "partner_type" | "application_data"> | null | undefined,
): boolean {
  if (!profile) return false;
  const type = (profile.partner_type ?? "").trim().toLowerCase();
  if (type === "individual") return true;
  if (type === "company") return false;
  return parseApplicationData(profile.application_data).applying_as === "individual";
}
