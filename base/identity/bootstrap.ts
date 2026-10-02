import type { SupabaseClient } from "@supabase/supabase-js";
import type { ProductKey } from "@/base/types";
import { isClientAudience } from "@/base/auth/landing";

function slugify(value: string) {
  return (
    value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 32) || "workspace"
  );
}

/**
 * What signing up gets you.
 *
 * `client_portal` is deliberately not here. A person reaches the Client Portal
 * because a professional invited them and they accepted — `accept-invite`
 * grants the entitlement at that moment. Handing it out at signup made it mean
 * nothing: every professional on this deployment holds `client_portal:trial`
 * and not one of them is anybody's client.
 *
 * Partner Admin invitees must not receive `partner_center` — they have no
 * partner profile and must not enter partner onboarding.
 */
const PRODUCTS: ProductKey[] = [
  "whitbyos",
  "academy",
  "partner_center",
];

async function isPartnerAdminInvitee(
  supabase: SupabaseClient,
  email?: string | null,
) {
  if (!email) return false;
  const normalized = email.trim().toLowerCase();
  const { data } = await supabase
    .from("partner_admins")
    .select("id")
    .eq("email", normalized)
    .in("status", ["invited", "active"])
    .maybeSingle();
  return Boolean(data);
}

export async function ensureBaseAccount(
  supabase: SupabaseClient,
  user: {
    id: string;
    email?: string | null;
    user_metadata?: Record<string, unknown>;
  },
) {
  if (await isClientAudience(user.id, user.email)) return;

  const fullName =
    (user.user_metadata?.full_name as string | undefined) ||
    user.email?.split("@")[0] ||
    "Workspace";

  const { data: memberships } = await supabase
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", user.id)
    .limit(1);

  let workspaceId = memberships?.[0]?.workspace_id as string | undefined;

  if (!workspaceId) {
    const { data: workspace, error } = await supabase
      .from("workspaces")
      .insert({
        name: `${fullName}'s workspace`,
        url_slug: `${slugify(fullName)}-${user.id.slice(0, 8)}`,
        owner_user_id: user.id,
      })
      .select("id")
      .single();

    if (error) throw error;
    workspaceId = workspace.id;

    await supabase.from("workspace_members").insert({
      workspace_id: workspaceId,
      user_id: user.id,
      role: "owner",
      status: "active",
    });
  }

  const skipPartnerCenter = await isPartnerAdminInvitee(supabase, user.email);
  const products = skipPartnerCenter
    ? PRODUCTS.filter((product) => product !== "partner_center")
    : PRODUCTS;

  const { data: existing } = await supabase
    .from("entitlements")
    .select("product")
    .eq("user_id", user.id);

  const have = new Set((existing ?? []).map((row) => row.product));

  const rows = products
    .filter((product) => !have.has(product))
    .map((product) => ({
      user_id: user.id,
      product,
      workspace_id:
        product === "academy" || product === "partner_center"
          ? null
          : workspaceId,
      status: "trial" as const,
      is_default_landing: false,
    }));

  if (rows.length > 0) {
    await supabase.from("entitlements").insert(rows);
  }

  if (skipPartnerCenter && have.has("partner_center")) {
    await supabase
      .from("entitlements")
      .delete()
      .eq("user_id", user.id)
      .eq("product", "partner_center");
  }
}
