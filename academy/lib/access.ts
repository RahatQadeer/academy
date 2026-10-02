import "server-only";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getSessionProfile } from "@/base/identity/session";
import { isSupabaseConfigured } from "@/base/lib/supabase/server";
import { ensureAcademyEntitlement, ensureLearnerMembership } from "./provision";
import type { AcademyActor } from "./types";

export type AcademyAccess =
  | { status: "preview"; user: null }
  | { status: "denied"; user: AcademyActor }
  | { status: "ok"; user: AcademyActor };

export async function requireAcademyAccess(): Promise<AcademyAccess> {
  if (!isSupabaseConfigured()) {
    return { status: "preview", user: null };
  }

  const profile = await getSessionProfile();
  if (!profile) {
    const pathname = (await headers()).get("x-pa-pathname") || "/academy";
    redirect(`/login?brand=academy&next=${encodeURIComponent(pathname)}`);
  }

  const user = { id: profile.user.id };

  // Self-heal first-time Academy entry: grant trial entitlement + Learner role
  // even when signup/login bootstrap was skipped or the session cache is stale.
  const entitled = await ensureAcademyEntitlement(user);
  if (!entitled) {
    return { status: "denied", user };
  }

  await ensureLearnerMembership(user);
  return { status: "ok", user };
}
