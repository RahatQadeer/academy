import "server-only";

import { siteUrl } from "@/base/auth/site";
import { createAdminClient, isSupabaseAdminConfigured } from "@/base/lib/supabase/admin";

type AdminEmailKind = "existing" | "new_account";

const ADMIN_META = {
  role: "Academy Admin",
  invite_type: "admin",
  product: "academy",
} as const;

export async function sendAdminInviteEmail(input: {
  kind: AdminEmailKind;
  email: string;
  displayName: string;
  inviteUrl?: string;
}): Promise<{ ok: true; channel: "supabase" } | { ok: false; message: string }> {
  if (!isSupabaseAdminConfigured()) {
    return { ok: false, message: "Supabase admin is not configured." };
  }

  const origin = siteUrl();
  const admin = createAdminClient();
  const data = {
    ...ADMIN_META,
    full_name: input.displayName,
  };

  if (input.kind === "new_account") {
    const redirectTo = input.inviteUrl ?? `${origin}/auth/callback?next=/academy/admin`;
    const { error } = await admin.auth.admin.inviteUserByEmail(input.email, {
      redirectTo,
      data,
    });
    if (error) {
      return { ok: false, message: error.message };
    }
    return { ok: true, channel: "supabase" };
  }

  const { error } = await admin.auth.signInWithOtp({
    email: input.email,
    options: {
      shouldCreateUser: false,
      emailRedirectTo: `${origin}/auth/callback?next=/academy/admin`,
    },
  });

  if (error) {
    return { ok: false, message: error.message };
  }

  return { ok: true, channel: "supabase" };
}
