import "server-only";

import { siteUrl } from "@/base/auth/site";
import { createAdminClient, isSupabaseAdminConfigured } from "@/base/lib/supabase/admin";

type InstructorEmailKind = "existing" | "new_account";

const INSTRUCTOR_META = {
  role: "Academy Instructor",
  invite_type: "instructor",
  product: "academy",
} as const;

export async function sendInstructorInviteEmail(input: {
  kind: InstructorEmailKind;
  email: string;
  displayName: string;
  programNames: string[];
  inviteUrl?: string;
}): Promise<{ ok: true; channel: "supabase" } | { ok: false; message: string }> {
  if (!isSupabaseAdminConfigured()) {
    return { ok: false, message: "Supabase admin is not configured." };
  }

  const origin = siteUrl();
  const admin = createAdminClient();
  const programs = input.programNames.join(", ");
  const data = {
    ...INSTRUCTOR_META,
    full_name: input.displayName,
    programs,
  };

  if (input.kind === "new_account") {
    const redirectTo =
      input.inviteUrl ?? `${origin}/auth/callback?next=/academy/instructor`;
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
      emailRedirectTo: `${origin}/auth/callback?next=/academy/instructor`,
    },
  });

  if (error) {
    return { ok: false, message: error.message };
  }

  return { ok: true, channel: "supabase" };
}
