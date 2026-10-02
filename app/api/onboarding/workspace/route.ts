import { NextResponse } from "next/server";
import { getConfiguredClient, jsonError, missingConfig } from "@/base/auth/http";
import {
  SLUG_TAKEN,
  isSlugTakenError,
  slugifyWorkspaceUrl,
  workspaceUrlError,
} from "@/whitbyos/lib/workspace-url";

export async function POST(request: Request) {
  const supabase = await getConfiguredClient();
  if (!supabase) return missingConfig();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return jsonError("Sign in to create a workspace.", 401);

  const body = (await request.json()) as {
    name?: string;
    urlSlug?: string;
    teamSize?: string;
    timezone?: string;
  };

  if (!body.name) return jsonError("Workspace name is required.");
  const slugProblem = workspaceUrlError(body.urlSlug || body.name);
  if (slugProblem) return jsonError(slugProblem);
  const urlSlug = slugifyWorkspaceUrl(body.urlSlug || body.name);

  const { data: workspace, error } = await supabase
    .from("workspaces")
    .insert({
      name: body.name,
      url_slug: urlSlug,
      team_size: body.teamSize || null,
      timezone: body.timezone || null,
      owner_user_id: user.id,
    })
    .select("*")
    .single();

  if (isSlugTakenError(error)) return jsonError(SLUG_TAKEN);
  if (error) return jsonError(error.message);

  await supabase.from("workspace_members").insert({
    workspace_id: workspace.id,
    user_id: user.id,
    role: "owner",
    status: "active",
  });

  await supabase.from("entitlements").insert({
    user_id: user.id,
    product: "whitbyos",
    workspace_id: workspace.id,
    status: "trial",
    is_default_landing: true,
  });

  return NextResponse.json({ redirect: "/onboarding/client-workspace" });
}
