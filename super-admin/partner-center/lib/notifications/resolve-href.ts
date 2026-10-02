import { PC_ADMIN } from "@/super-admin/partner-center/lib/paths";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Admin notifications must land on staff routes, not the partner app. */
export function resolveAdminNotificationHref(input: {
  href?: string | null;
  entityType?: string | null;
  entityId?: string | null;
}): string | null {
  if (input.entityType === "partner_opportunity" && input.entityId) {
    return PC_ADMIN.opportunity(input.entityId);
  }

  if (input.entityType === "partner_application" && input.entityId) {
    return PC_ADMIN.application(input.entityId);
  }

  if (input.entityType === "partner_profile" && input.entityId) {
    return PC_ADMIN.message(input.entityId);
  }

  if (input.entityType === "payment_unmatched") {
    return PC_ADMIN.opportunities;
  }

  const href = input.href?.trim();
  if (!href) return null;

  const partnerMatch = href.match(
    /^\/partner-center\/opportunities\/([0-9a-f-]{36})$/i,
  );
  if (partnerMatch?.[1] && UUID_RE.test(partnerMatch[1])) {
    return PC_ADMIN.opportunity(partnerMatch[1]);
  }

  const messageMatch = href.match(
    /^\/super-admin\/partner-center\/messages\/([0-9a-f-]{36})$/i,
  );
  if (messageMatch?.[1] && UUID_RE.test(messageMatch[1])) {
    return PC_ADMIN.message(messageMatch[1]);
  }

  const applicationMatch = href.match(
    /^\/super-admin\/partner-center\/applications\/([0-9a-f-]{36})$/i,
  );
  if (applicationMatch?.[1] && UUID_RE.test(applicationMatch[1])) {
    return PC_ADMIN.application(applicationMatch[1]);
  }

  if (href.startsWith("/super-admin/")) {
    return href;
  }

  return href.startsWith("/") ? href : null;
}
