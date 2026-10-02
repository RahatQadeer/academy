"use server";

import { revalidatePath } from "next/cache";
import {
  invitePartnerAdmin,
  revokePartnerAdmin,
} from "@/partner-center/admin/lib/invite";
import { adminWriter } from "@/super-admin/partner-center/lib/admin-writer";

export async function invitePartnerAdminAction(input: {
  email: string;
}): Promise<
  | {
      ok: true;
      inviteUrl: string;
      emailSent: boolean;
      emailError?: string;
    }
  | { ok: false; error: string }
> {
  const loaded = await adminWriter();
  if ("error" in loaded) return { ok: false, error: loaded.error };

  const result = await invitePartnerAdmin({
    email: input.email,
    invitedByEmail: loaded.staffEmail,
  });
  if (!result.ok) return result;

  revalidatePath("/super-admin/users");
  return {
    ok: true,
    inviteUrl: result.inviteUrl,
    emailSent: result.emailSent,
    emailError: result.emailError,
  };
}

export async function revokePartnerAdminAction(input: {
  email: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const loaded = await adminWriter();
  if ("error" in loaded) return { ok: false, error: loaded.error };

  const result = await revokePartnerAdmin({
    email: input.email,
    revokedByEmail: loaded.staffEmail,
  });
  if (!result.ok) return result;

  revalidatePath("/super-admin/users");
  return { ok: true };
}
