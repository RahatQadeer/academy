import "server-only";

import { getSessionProfile } from "@/base/identity/session";
import {
  canAccessSuperAdminArea,
  isAcademySuperAdmin,
} from "@/academy/lib/authorization";

/** Academy Admin grant/revoke UI is Super-Admin-only (matches academy_grant_admin RPC). */
export async function requireAcademySuperAdminActor(): Promise<
  { ok: true; userId: string } | { ok: false; reason: "unauthorized" }
> {
  const profile = await getSessionProfile();
  if (!profile) return { ok: false, reason: "unauthorized" };
  const actor = { id: profile.user.id };
  const [area, superAdmin] = await Promise.all([
    canAccessSuperAdminArea(actor),
    isAcademySuperAdmin(actor),
  ]);
  if (!area || !superAdmin) return { ok: false, reason: "unauthorized" };
  return { ok: true, userId: profile.user.id };
}
