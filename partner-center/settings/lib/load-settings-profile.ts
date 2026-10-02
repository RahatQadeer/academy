import { createClient, isSupabaseConfigured } from "@/base/lib/supabase/server";
import type { PartnerAccess } from "@/partner-center/lib/access";
import {
  applicationDataRecord,
  parseNotificationPrefs,
} from "@/partner-center/settings/lib/notification-prefs";
import type { SettingsProfileData } from "@/partner-center/settings/types";

const AVATAR_BUCKET = "avatars";

function avatarStoragePath(userId: string) {
  return `${userId}/photo`;
}

function passwordChangedAtFrom(raw: unknown): string | null {
  const data = applicationDataRecord(raw);
  const value = data.password_changed_at;
  return typeof value === "string" && value.trim() ? value : null;
}

export async function loadSettingsProfile(
  access: PartnerAccess,
): Promise<SettingsProfileData> {
  const { user, context } = access;
  const contact = context?.contact ?? null;
  const profile = context?.profile ?? null;

  let firstName = (contact?.first_name ?? "").trim();
  let lastName = (contact?.last_name ?? "").trim();

  if (!firstName && !lastName) {
    const full = (user.preferred_name || user.full_name || "").trim();
    if (full) {
      const parts = full.split(/\s+/).filter(Boolean);
      firstName = parts[0] ?? "";
      lastName = parts.slice(1).join(" ");
    } else {
      firstName = "You";
    }
  }

  const displayName =
    [firstName, lastName].filter(Boolean).join(" ") ||
    user.preferred_name ||
    user.full_name ||
    "You";

  let avatarUrl = user.avatar_url;
  if (isSupabaseConfigured() && user.id !== "preview") {
    const supabase = await createClient();
    const { data: signed } = await supabase.storage
      .from(AVATAR_BUCKET)
      .createSignedUrl(avatarStoragePath(user.id), 3600);
    if (signed?.signedUrl) avatarUrl = signed.signedUrl;
  }

  return {
    userId: user.id,
    contactId: contact?.id ?? null,
    profileId: profile?.id ?? null,
    firstName,
    lastName,
    email: user.email || contact?.email || "",
    phone: user.phone || contact?.phone || "",
    title: (contact?.title_role ?? "").trim(),
    displayName,
    avatarUrl,
    notificationPrefs: parseNotificationPrefs(profile?.application_data),
    passwordChangedAt: passwordChangedAtFrom(profile?.application_data),
  };
}

export { avatarStoragePath, AVATAR_BUCKET };
