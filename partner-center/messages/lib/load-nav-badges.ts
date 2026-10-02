import { isSupabaseConfigured } from "@/base/lib/supabase/server";
import { demoUnreadCount } from "@/partner-center/messages/lib/demo-fixtures";
import { partnerMessagesVisibleSince } from "@/partner-center/messages/lib/message-visibility";
import { loadPartnerUnreadCount } from "@/partner-center/messages/lib/unread-count";
import { resolvePartner } from "@/partner-center/lib/resolve-partner";
import type { Entitlement, User } from "@/base/types";

export type PartnerNavBadges = {
  messages?: number;
};

export async function loadPartnerNavBadges(
  user: User | null,
  entitlements: Entitlement[] = [],
): Promise<PartnerNavBadges | null> {
  if (!isSupabaseConfigured()) {
    const count = demoUnreadCount();
    return count > 0 ? { messages: count } : null;
  }

  if (!user) return null;

  if (user.id === "preview") {
    const count = demoUnreadCount();
    return count > 0 ? { messages: count } : null;
  }

  const context = await resolvePartner(user, entitlements);
  const profileId = context?.profile?.id;
  if (!profileId) return null;

  const count = await loadPartnerUnreadCount(
    profileId,
    user.id,
    partnerMessagesVisibleSince(context),
  );
  return count > 0 ? { messages: count } : null;
}
