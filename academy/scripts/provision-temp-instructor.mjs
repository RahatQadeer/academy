/**
 * TEMPORARY — provision Brent’s capped course-builder instructor.
 * Safe to delete this script after the helper account is retired.
 *
 * Usage (repo root, with .env.local loaded):
 *   node --env-file=.env.local academy/scripts/provision-temp-instructor.mjs
 */

import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "crypto";

const EMAIL = (process.env.ACADEMY_TEMP_INSTRUCTOR_EMAILS ?? "academy.temp.builder@righttail.org")
  .split(",")[0]
  .trim()
  .toLowerCase();
const FULL_NAME = "Academy Temp Builder";
const CAP = Number(process.env.ACADEMY_TEMP_INSTRUCTOR_COURSE_CAP ?? 10) || 10;

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const admin = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function makePassword() {
  // Readable for humans sharing via chat; still 20 chars mixed.
  const raw = randomBytes(12).toString("base64url");
  return `Tmp-${raw}-10`;
}

async function findAuthUserByEmail(email) {
  let page = 1;
  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const match = data.users.find((user) => user.email?.toLowerCase() === email);
    if (match) return match;
    if (data.users.length < 200) return null;
    page += 1;
  }
}

async function main() {
  const password = makePassword();
  let userId;
  let created = false;

  const existing = await findAuthUserByEmail(EMAIL);
  if (existing) {
    userId = existing.id;
    const { error } = await admin.auth.admin.updateUserById(userId, {
      password,
      email_confirm: true,
      user_metadata: { full_name: FULL_NAME },
    });
    if (error) throw error;
    console.log("Updated existing auth user password.");
  } else {
    const { data, error } = await admin.auth.admin.createUser({
      email: EMAIL,
      password,
      email_confirm: true,
      user_metadata: { full_name: FULL_NAME },
    });
    if (error) throw error;
    userId = data.user.id;
    created = true;
    console.log("Created auth user.");
  }

  // public.users — usually created by trigger; upsert defensively.
  const { error: userError } = await admin.from("users").upsert(
    {
      id: userId,
      email: EMAIL,
      full_name: FULL_NAME,
    },
    { onConflict: "id" },
  );
  if (userError) {
    console.warn("users upsert warning:", userError.message);
  }

  // Academy entitlement
  const { data: ent } = await admin
    .from("entitlements")
    .select("id, status")
    .eq("user_id", userId)
    .eq("product", "academy")
    .maybeSingle();
  if (!ent) {
    const { error } = await admin.from("entitlements").insert({
      user_id: userId,
      product: "academy",
      workspace_id: null,
      status: "active",
      is_default_landing: true,
    });
    if (error) throw error;
  } else if (ent.status !== "active" && ent.status !== "trial") {
    await admin.from("entitlements").update({ status: "active" }).eq("id", ent.id);
  }

  // Suspend other academy roles (exclusive role rule)
  await admin
    .from("academy_memberships")
    .update({ status: "suspended" })
    .eq("user_id", userId)
    .neq("role", "instructor")
    .eq("status", "active");

  const { data: membership } = await admin
    .from("academy_memberships")
    .select("id, status")
    .eq("user_id", userId)
    .eq("role", "instructor")
    .maybeSingle();

  if (!membership) {
    const { error } = await admin.from("academy_memberships").insert({
      user_id: userId,
      role: "instructor",
      status: "active",
    });
    if (error) throw error;
  } else if (membership.status !== "active") {
    await admin
      .from("academy_memberships")
      .update({ status: "active", granted_at: new Date().toISOString() })
      .eq("id", membership.id);
  }

  const site = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");

  console.log("\n—— TEMP instructor ready (remove later) ——");
  console.log(`Email:        ${EMAIL}`);
  console.log(`Password:     ${password}`);
  console.log(`Login:        ${site}/login?brand=academy&next=/academy/instructor`);
  console.log(`Course cap:   ${CAP} (enforced when ACADEMY_TEMP_INSTRUCTOR_EMAILS includes this email)`);
  console.log(`Auth user:    ${userId} (${created ? "created" : "reset password"})`);
  console.log("Forward these credentials to Brent. Do not commit this password.\n");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
