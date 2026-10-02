import "server-only";

import {
  createServiceClient,
} from "@/partner-center/admin/lib/constants";
import { getActivePartnerAdmin } from "@/partner-center/admin/lib/require-partner-admin";
import { getStaffSession } from "@/super-admin/lib/staff-session";
import {
  createAdminClient,
  isAdminDataConfigured,
} from "@/super-admin/partner-center/lib/admin-client";

type WriterOk = {
  admin: NonNullable<ReturnType<typeof createAdminClient>>;
  actorUserId: string | null;
  staffEmail: string;
  kind: "super_admin" | "partner_admin";
};

/**
 * Partner Admin service-role writer. Checks role before any DB work.
 */
export async function partnerAdminWriter(): Promise<
  { error: string } | WriterOk
> {
  if (!isAdminDataConfigured()) {
    return { error: "Supabase admin is not configured." };
  }

  const session = await getActivePartnerAdmin();
  if (!session) {
    return { error: "Sign in as Partner Admin to continue." };
  }

  const admin = createAdminClient() ?? createServiceClient();
  if (!admin) {
    return { error: "Supabase admin is not configured." };
  }

  return {
    admin,
    actorUserId: session.userId,
    staffEmail: session.email,
    kind: "partner_admin",
  };
}

/** Super Admin cookie or active Partner Admin — for shared read loaders. */
export async function staffReader(): Promise<
  { error: string } | { kind: "super_admin" | "partner_admin"; email: string }
> {
  const staff = await getStaffSession();
  if (staff?.email) {
    return { kind: "super_admin", email: staff.email };
  }

  const session = await getActivePartnerAdmin();
  if (session) {
    return { kind: "partner_admin", email: session.email };
  }

  return { error: "Unauthorized." };
}
