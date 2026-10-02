import "server-only";

import { getSessionProfile } from "@/base/identity/session";
import {
  canAccessAdminArea,
  canAuthorProgram,
  isAcademyAdmin,
} from "@/academy/lib/authorization";

export async function authorizeCatalogAuthor(programId: string) {
  const profile = await getSessionProfile();
  if (!profile) return { ok: false as const, reason: "unauthorized" as const };

  const actor = { id: profile.user.id };
  const [area, admin, author] = await Promise.all([
    canAccessAdminArea(actor),
    isAcademyAdmin(actor),
    canAuthorProgram(actor, programId),
  ]);
  const isAdmin = Boolean(area && admin);
  if (!isAdmin && !author) return { ok: false as const, reason: "unauthorized" as const };

  return { ok: true as const, userId: profile.user.id, isAdmin };
}
