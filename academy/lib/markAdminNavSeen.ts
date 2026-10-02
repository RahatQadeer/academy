"use server";

import { cookies } from "next/headers";
import { getSessionProfile } from "@/base/identity/session";
import { canAccessAdminArea, isAcademyAdmin } from "@/academy/lib/authorization";
import { ADMIN_NAV_SEEN_COOKIE, parseAdminNavSeen } from "@/academy/lib/adminNavSeen";

export async function markAdminNavSeenAction(key: "enrollments") {
  if (key !== "enrollments") return { ok: false as const };

  try {
    const profile = await getSessionProfile();
    if (!profile) return { ok: false as const };

    const actor = { id: profile.user.id };
    const [area, admin] = await Promise.all([canAccessAdminArea(actor), isAcademyAdmin(actor)]);
    if (!area || !admin) return { ok: false as const };

    const store = await cookies();
    const current = parseAdminNavSeen(store.get(ADMIN_NAV_SEEN_COOKIE)?.value, profile.user.id);
    store.set(
      ADMIN_NAV_SEEN_COOKIE,
      JSON.stringify({
        ...current,
        userId: profile.user.id,
        enrollmentsSeenAt: new Date().toISOString(),
      }),
      {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 365,
      },
    );
    return { ok: true as const };
  } catch {
    return { ok: false as const };
  }
}
