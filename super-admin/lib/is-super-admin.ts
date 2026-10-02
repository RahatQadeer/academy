import "server-only";

import { redirect } from "next/navigation";
import { getStaffSession } from "@/super-admin/lib/staff-session";

/** True when a valid Super Admin staff cookie is present. */
export async function isSuperAdmin(): Promise<boolean> {
  const session = await getStaffSession();
  return Boolean(session?.email);
}

/**
 * Assert Super Admin staff cookie session.
 * Returns the staff email, or redirects to sign-in.
 */
export async function requireSuperAdmin(): Promise<string> {
  const session = await getStaffSession();
  if (!session?.email) {
    redirect("/super-admin/signin");
  }
  return session.email;
}
