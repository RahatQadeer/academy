import type { PartnerContext } from "@/partner-center/types/partner";

/**
 * Who may submit / edit opportunities.
 *
 * Access level is the write gate (admin | standard). Contact function
 * `read_only` also denies writes — invite UI has both fields and people often
 * set Function=Read Only while leaving Access=Standard.
 */
export function partnerCanMutateOpportunities(
  context: PartnerContext | null | undefined,
): boolean {
  if (!context?.profile) return false;

  const member = context.teamMember;
  if (member) {
    const access = (member.access_level ?? "").toLowerCase();
    const fn = (member.function ?? "").toLowerCase();
    if (access === "read_only" || fn === "read_only") return false;
    return access === "admin" || access === "standard";
  }

  // Legacy primary contact without a team row — still the applicant/owner.
  return (
    Boolean(context.contact?.id) &&
    context.contact!.id === context.profile.primary_contact_id
  );
}

/** @deprecated Prefer partnerCanMutateOpportunities(context). */
export function canMutateOpportunities(
  accessLevel: string | null | undefined,
): boolean {
  const access = (accessLevel ?? "").toLowerCase();
  if (access === "read_only") return false;
  return access === "admin" || access === "standard";
}

export function isOpportunityEditable(status: string | null | undefined): boolean {
  const key = (status ?? "").toLowerCase();
  return key === "submitted" || key === "accepted";
}

export function protectionDaysLabel(
  acceptedAt: string | null,
  protectedUntil: string | null,
): string {
  if (!acceptedAt || !protectedUntil) return "a protection period";
  const start = Date.parse(acceptedAt);
  const end = Date.parse(protectedUntil);
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) {
    return "a protection period";
  }
  const days = Math.round((end - start) / (24 * 60 * 60 * 1000));
  if (days <= 0) return "a protection period";
  return `${days}-day protection period`;
}
