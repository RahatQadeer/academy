import "server-only";

import { getStaffSession } from "@/super-admin/lib/staff-session";
import {
  createAdminClient,
  isAdminDataConfigured,
} from "@/super-admin/partner-center/lib/admin-client";

type WriterOk = {
  admin: NonNullable<ReturnType<typeof createAdminClient>>;
  /** No public.users row for DB-credential staff — audits skip when null. */
  actorUserId: string | null;
  staffEmail: string;
};

/**
 * Service-role writer for Partner Center admin actions.
 * Requires the Super Admin staff cookie (not product Auth).
 */
export async function adminWriter(): Promise<{ error: string } | WriterOk> {
  if (!isAdminDataConfigured()) {
    return { error: "Supabase admin is not configured." };
  }

  const admin = createAdminClient();
  if (!admin) {
    return { error: "Supabase admin is not configured." };
  }

  const session = await getStaffSession();
  if (!session?.email) {
    return { error: "Sign in as Super Admin to continue." };
  }

  return { admin, actorUserId: null, staffEmail: session.email };
}
