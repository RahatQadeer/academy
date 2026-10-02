import type { PartnerContext } from "@/partner-center/types/partner";

/**
 * Invited teammates start with an empty Messages view: they only see traffic
 * from their membership `created_at` onward. Primary contact / applicants keep
 * the full company thread (including the opening staff note).
 */
export function partnerMessagesVisibleSince(
  context: PartnerContext | null | undefined,
): string | null {
  const member = context?.teamMember;
  if (!member?.created_at) return null;

  const contactId = context?.contact?.id;
  const primaryId = context?.profile?.primary_contact_id;
  if (contactId && primaryId && contactId === primaryId) return null;

  return member.created_at;
}

export function filterPartnerMessagesSince<T extends { created_at: string }>(
  rows: T[],
  since: string | null,
): T[] {
  if (!since) return rows;
  return rows.filter((row) => row.created_at >= since);
}
