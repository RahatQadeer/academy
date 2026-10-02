import { getSessionProfile } from "@/base/identity/session";
import { createClient, isSupabaseConfigured } from "@/base/lib/supabase/server";
import { getWorkspaceLogoUrl } from "@/whitbyos/lib/logo";
import { getCurrentWorkspaceId } from "@/whitbyos/lib/workspace";
import type { OnboardingWorkspace } from "@/whitbyos/onboarding/components/OnboardingShell";

/**
 * The workspace shown in the onboarding header from step 2 onward, once it
 * exists and has been named. Returns null during step 1, when there is nothing
 * meaningful to show yet.
 */
export async function getOnboardingWorkspace(): Promise<OnboardingWorkspace | null> {
  if (!isSupabaseConfigured()) return null;

  const profile = await getSessionProfile();
  const workspace = profile?.workspaces[0];
  if (!workspace) return null;

  return {
    name: workspace.name,
    logoUrl: await getWorkspaceLogoUrl(workspace.logo_url),
  };
}

/**
 * Work types chosen during onboarding (SRS §4.3). Returns an empty list when
 * the step was skipped, or when the settings table has not been migrated yet.
 */
export async function getWorkTypes(): Promise<string[]> {
  if (!isSupabaseConfigured()) return [];

  const profile = await getSessionProfile();
  const workspace = profile?.workspaces[0];
  if (!workspace) return [];

  const supabase = await createClient();
  const { data } = await supabase
    .from("whitbyos_workspace_settings")
    .select("work_types")
    .eq("workspace_id", workspace.id)
    .maybeSingle();

  const types = data?.work_types;
  return Array.isArray(types) ? (types as string[]) : [];
}

/**
 * Whether this professional still needs to run through onboarding.
 *
 * Base's `ensureBaseAccount` creates a workspace for every new account so the
 * app has somewhere to put things — named "<Name>'s workspace" with a
 * generated slug, and nothing else filled in. That means a first-time user
 * lands straight in Whitby and never sees the setup flow SRS §4.2 requires,
 * leaving them with a name they never chose.
 *
 * `team_size` is the signal: onboarding step 1 always sets it, and the
 * automatic path never does. No schema change needed to tell them apart.
 *
 * Only the workspace OWNER is sent to onboarding. Someone who joined through
 * an invitation is not setting up the workspace and must not be asked to.
 */
export async function needsOnboarding(): Promise<boolean> {
  const profile = await getSessionProfile();
  const workspace = profile?.workspaces[0];
  if (!workspace) return false;

  if (workspace.owner_user_id !== profile?.user.id) return false;
  if (workspace.team_size) return false;

  // Guard against sending someone back who has already started real work.
  const supabase = await createClient();
  const { count } = await supabase
    .from("whitbyos_clients")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", workspace.id);

  return (count ?? 0) === 0;
}

/**
 * What the setup steps have already been told.
 *
 * Every step writes as it goes, and every step then drew itself empty: going
 * Back to change one answer meant typing the other four again, which is the
 * fastest way to teach somebody not to press Back. The row is already there;
 * this is it, read.
 */
export async function getOnboardingDefaults(): Promise<{
  name: string;
  urlSlug: string;
  teamSize: string;
  timezone: string;
  workTypes: string[];
}> {
  const empty = { name: "", urlSlug: "", teamSize: "", timezone: "", workTypes: [] as string[] };
  if (!isSupabaseConfigured()) return empty;

  const profile = await getSessionProfile();
  const workspace = profile?.workspaces[0] as
    | { name?: string | null; url_slug?: string | null; team_size?: string | null; timezone?: string | null }
    | undefined;

  if (!workspace) return empty;

  return {
    name: workspace.name ?? "",
    urlSlug: workspace.url_slug ?? "",
    teamSize: workspace.team_size ?? "",
    timezone: workspace.timezone ?? "",
    workTypes: await getWorkTypes(),
  };
}

/**
 * The answer step 3 was given, and the client it made.
 *
 * Same reason as `getOnboardingDefaults`: pressing Back to check something
 * should not throw away the client whose name has just been typed. Null where
 * the step has not been answered, which is not the same as "No".
 */
export async function getOnboardingClientStep(): Promise<{
  uses: "yes" | "no" | null;
  name: string;
  clientType: string;
  primaryContact: string;
  primaryContactEmail: string;
  primaryContactPhone: string;
  portal: boolean;
}> {
  const empty = {
    uses: null,
    name: "",
    clientType: "",
    primaryContact: "",
    primaryContactEmail: "",
    primaryContactPhone: "",
    portal: false,
  } as const;
  if (!isSupabaseConfigured()) return { ...empty };

  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) return { ...empty };

  const supabase = await createClient();

  const { data: settings } = await supabase
    .from("whitbyos_workspace_settings")
    .select("uses_client_workspaces")
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  const decided = settings?.uses_client_workspaces as boolean | null | undefined;
  const uses = decided === true ? "yes" : decided === false ? "no" : null;

  if (uses !== "yes") return { ...empty, uses };

  /* The newest client of this workspace, which during setup is the one this
     step made. Its primary contact, if it was given one, comes off the
     membership the same step wrote. */
  const { data: client } = await supabase
    .from("whitbyos_clients")
    .select("id, name, client_type")
    .eq("workspace_id", workspaceId)
    .is("archived_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!client) return { ...empty, uses };

  const { data: member } = await supabase
    .from("whitbyos_client_members")
    .select("portal_access, contact:contacts!contact_id (first_name, last_name, email, phone)")
    .eq("client_id", client.id as string)
    .limit(1)
    .maybeSingle();

  const contact = (Array.isArray(member?.contact) ? member?.contact[0] : member?.contact) as
    | { first_name?: string | null; last_name?: string | null; email?: string | null; phone?: string | null }
    | undefined;

  return {
    uses,
    name: (client.name as string) ?? "",
    clientType: (client.client_type as string) ?? "",
    primaryContact: [contact?.first_name, contact?.last_name].filter(Boolean).join(" "),
    primaryContactEmail: contact?.email ?? "",
    primaryContactPhone: contact?.phone ?? "",
    portal: Boolean(member?.portal_access),
  };
}
