const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Partner notifications must land on partner-center routes, not staff. */
export function resolvePartnerNotificationHref(input: {
  href?: string | null;
  entityType?: string | null;
  entityId?: string | null;
}): string | null {
  if (input.entityType === "partner_opportunity" && input.entityId) {
    if (UUID_RE.test(input.entityId)) {
      return `/partner-center/opportunities/${input.entityId}`;
    }
  }

  if (input.entityType === "partner_referral" && input.entityId) {
    if (UUID_RE.test(input.entityId)) {
      return `/partner-center/referrals/${input.entityId}`;
    }
  }

  const href = input.href?.trim();
  if (!href) {
    if (input.entityType === "partner_profile" && input.entityId) {
      if (UUID_RE.test(input.entityId)) {
        return "/partner-center/messages";
      }
    }
    return null;
  }

  const opportunityMatch = href.match(
    /^\/partner-center\/opportunities\/([0-9a-f-]{36})$/i,
  );
  if (opportunityMatch?.[1] && UUID_RE.test(opportunityMatch[1])) {
    return `/partner-center/opportunities/${opportunityMatch[1]}`;
  }

  const referralMatch = href.match(
    /^\/partner-center\/referrals\/([0-9a-f-]{36})$/i,
  );
  if (referralMatch?.[1] && UUID_RE.test(referralMatch[1])) {
    return `/partner-center/referrals/${referralMatch[1]}`;
  }

  if (href.startsWith("/partner-center/")) {
    return href;
  }

  return null;
}
