"use server";

import { partnerFacingError } from "@/partner-center/lib/user-facing-error";
import { revalidatePath } from "next/cache";
import { createClient, isSupabaseConfigured } from "@/base/lib/supabase/server";
import { requirePartnerAppAccess } from "@/partner-center/lib/access";
import { PARTNER_PATHS } from "@/partner-center/lib/review-state";
import {
  applicationDataRecord,
  parseNotificationPrefs,
} from "@/partner-center/settings/lib/notification-prefs";
import {
  AVATAR_BUCKET,
  avatarStoragePath,
} from "@/partner-center/settings/lib/load-settings-profile";
import type { NotificationPrefs } from "@/partner-center/settings/types";

const MAX_AVATAR_BYTES = 5 * 1024 * 1024;

type ActionResult = { ok: true } | { error: string };

function revalidateSettings() {
  revalidatePath(PARTNER_PATHS.settingsProfile);
  revalidatePath(PARTNER_PATHS.settingsNotifications);
  revalidatePath(PARTNER_PATHS.settingsSecurity);
  revalidatePath(PARTNER_PATHS.settingsTax);
  revalidatePath(PARTNER_PATHS.settingsTaxSetup);
  revalidatePath(PARTNER_PATHS.settingsTaxStripe);
  revalidatePath("/[product]/[[...slug]]", "page");
}

export async function savePartnerProfile(input: {
  firstName: string;
  lastName: string;
  title: string;
}): Promise<ActionResult> {
  if (!isSupabaseConfigured()) {
    return { error: "Connect Supabase to save profile changes." };
  }

  const access = await requirePartnerAppAccess();
  if (access.user.id === "preview") {
    return { error: "Connect Supabase to save profile changes." };
  }

  const firstName = input.firstName.trim();
  const lastName = input.lastName.trim();
  const title = input.title.trim();

  if (!firstName) return { error: "First name is required." };

  const fullName = [firstName, lastName].filter(Boolean).join(" ");
  const supabase = await createClient();
  const now = new Date().toISOString();

  const { error: userError } = await supabase
    .from("users")
    .update({
      full_name: fullName,
      preferred_name: firstName,
      updated_at: now,
    })
    .eq("id", access.user.id);

  if (userError) return { error: partnerFacingError("Could not save your settings.", userError.message) };

  const contactId = access.context?.contact?.id;
  if (contactId) {
    const { error: contactError } = await supabase
      .from("contacts")
      .update({
        first_name: firstName,
        last_name: lastName || firstName,
        title_role: title || null,
        updated_at: now,
      })
      .eq("id", contactId);

    if (contactError) return { error: partnerFacingError("Could not save your settings.", contactError.message) };
  }

  revalidateSettings();
  return { ok: true };
}

export async function uploadPartnerAvatar(
  formData: FormData,
): Promise<ActionResult> {
  if (!isSupabaseConfigured()) {
    return { error: "Connect Supabase to upload a photo." };
  }

  const access = await requirePartnerAppAccess();
  if (access.user.id === "preview") {
    return { error: "Connect Supabase to upload a photo." };
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Choose a photo to upload." };
  }
  if (file.size > MAX_AVATAR_BYTES) {
    return { error: "Photos must be 5 MB or smaller." };
  }
  const type = (file.type || "").toLowerCase();
  if (
    type &&
    type !== "image/jpeg" &&
    type !== "image/jpg" &&
    type !== "image/png"
  ) {
    return { error: "Use a JPG or PNG image, at least 200×200px." };
  }

  const supabase = await createClient();
  const path = avatarStoragePath(access.user.id);
  const { error: uploadError } = await supabase.storage
    .from(AVATAR_BUCKET)
    .upload(path, file, {
      contentType: file.type || "image/jpeg",
      upsert: true,
    });

  if (uploadError) return { error: partnerFacingError("Could not save your settings.", uploadError.message) };

  const { data: signed } = await supabase.storage
    .from(AVATAR_BUCKET)
    .createSignedUrl(path, 60 * 60 * 24 * 365);

  const { error: updateError } = await supabase
    .from("users")
    .update({
      avatar_url: signed?.signedUrl ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", access.user.id);

  if (updateError) return { error: partnerFacingError("Could not save your settings.", updateError.message) };

  revalidateSettings();
  return { ok: true };
}

export async function savePartnerNotificationPrefs(
  prefs: NotificationPrefs,
): Promise<ActionResult> {
  if (!isSupabaseConfigured()) {
    return { error: "Connect Supabase to save notification preferences." };
  }

  const access = await requirePartnerAppAccess();
  const profileId = access.context?.profile?.id;
  if (!profileId) {
    return { error: "No partner profile is available yet." };
  }

  const normalized = parseNotificationPrefs(prefs);
  const supabase = await createClient();
  const existing = applicationDataRecord(
    access.context?.profile?.application_data,
  );

  const { error } = await supabase
    .from("partner_profiles")
    .update({
      application_data: {
        ...existing,
        notification_prefs: normalized,
      },
      updated_at: new Date().toISOString(),
    })
    .eq("id", profileId);

  if (error) return { error: partnerFacingError("Could not save your settings.", error.message) };

  revalidateSettings();
  return { ok: true };
}

export async function changePartnerPassword(input: {
  currentPassword: string;
  password: string;
  confirmPassword: string;
  /** Required when authenticator MFA is enabled (AAL2). */
  mfaCode?: string;
}): Promise<ActionResult> {
  if (!isSupabaseConfigured()) {
    return { error: "Connect Supabase to change your password." };
  }

  const access = await requirePartnerAppAccess();
  const email = access.user.email?.trim();
  if (!email) return { error: "Your account email is missing." };

  const currentPassword = input.currentPassword;
  const password = input.password;
  const confirm = input.confirmPassword;

  if (!currentPassword) return { error: "Enter your current password." };
  if (password.length < 8) {
    return { error: "Use at least 8 characters." };
  }
  if (password !== confirm) {
    return { error: "Those passwords do not match." };
  }

  const supabase = await createClient();
  const { error: verifyError } = await supabase.auth.signInWithPassword({
    email,
    password: currentPassword,
  });
  if (verifyError) {
    return { error: "Current password is incorrect." };
  }

  const { data: factors } = await supabase.auth.mfa.listFactors();
  const totpFactor =
    factors?.totp?.find((factor) => factor.status === "verified") ??
    (factors?.all ?? []).find(
      (factor) => factor.factor_type === "totp" && factor.status === "verified",
    );

  if (totpFactor) {
    const code = (input.mfaCode ?? "").replace(/\D/g, "");
    if (code.length !== 6) {
      return {
        error: "Enter the six-digit code from your authenticator app.",
      };
    }

    const { data: challenge, error: challengeError } =
      await supabase.auth.mfa.challenge({ factorId: totpFactor.id });
    if (challengeError || !challenge) {
      return {
        error:
          challengeError?.message ??
          "Could not start authenticator verification.",
      };
    }

    const { error: mfaError } = await supabase.auth.mfa.verify({
      factorId: totpFactor.id,
      challengeId: challenge.id,
      code,
    });
    if (mfaError) {
      return {
        error:
          mfaError.message.toLowerCase().includes("invalid")
            ? "That authenticator code is incorrect or expired."
            : mfaError.message,
      };
    }
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    const lower = error.message.toLowerCase();
    if (lower.includes("aal2")) {
      return {
        error:
          "Enter the six-digit code from your authenticator app to change your password.",
      };
    }
    return { error: partnerFacingError("Could not save your settings.", error.message) };
  }

  const profileId = access.context?.profile?.id;
  if (profileId) {
    const existing = applicationDataRecord(
      access.context?.profile?.application_data,
    );
    await supabase
      .from("partner_profiles")
      .update({
        application_data: {
          ...existing,
          password_changed_at: new Date().toISOString(),
        },
        updated_at: new Date().toISOString(),
      })
      .eq("id", profileId);
  }

  revalidateSettings();
  return { ok: true };
}
