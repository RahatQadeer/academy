import type { SupabaseClient } from "@supabase/supabase-js";
import { CONTACT_SOURCE } from "@/partner-center/lib/referral-capture/constants";

function splitName(full: string): { first_name: string; last_name: string } {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { first_name: "", last_name: "" };
  if (parts.length === 1) return { first_name: parts[0], last_name: "" };
  return {
    first_name: parts[0],
    last_name: parts.slice(1).join(" "),
  };
}

export async function findOrCreateContactByEmail(
  supabase: SupabaseClient,
  input: { email: string; fullName?: string },
): Promise<string | null> {
  const email = input.email.trim().toLowerCase();
  if (!email || !email.includes("@")) return null;

  const { first_name, last_name } = splitName(input.fullName?.trim() || "");
  const contactFields = {
    first_name: first_name || email.split("@")[0] || "User",
    last_name: last_name || "",
    email,
    source: CONTACT_SOURCE,
    created_by_workspace_id: null,
  };

  const { data: existing } = await supabase
    .from("contacts")
    .select("id")
    .ilike("email", email)
    .limit(1)
    .maybeSingle();

  if (existing?.id) {
    const { error } = await supabase
      .from("contacts")
      .update(contactFields)
      .eq("id", existing.id);
    if (error) return null;
    return existing.id as string;
  }

  const { data: created, error } = await supabase
    .from("contacts")
    .insert(contactFields)
    .select("id")
    .single();

  if (error || !created?.id) return null;
  return created.id as string;
}
