import { createAdminClient } from "@/whitbyos/lib/supabase-admin";

export type InvitationRecord = {
  id: string;
  token: string;
  inviter_user_id: string | null;
  invitee_email: string;
  invitee_name: string | null;
  context_type: string;
  context_id: string | null;
  role_or_relationship: string | null;
  status: string;
  expires_at: string | null;
};

/**
 * Reads an invitation by its token, for someone who has no session yet.
 *
 * This has to bypass RLS, and the reason is the whole design of an invitation:
 * `invitations_select` lets a row through for its inviter, its creator, or the
 * address it was sent to — all of which need `auth.uid()`. The person opening
 * the link has no account yet. That is what they are here to make.
 *
 * The token is the credential. It is a random uuid, it is only ever sent to the
 * one address, and it expires; holding it is the proof. So the lookup is by
 * exact token and nothing else — there is no way to list, search or enumerate
 * through this, and only the fields the invitation screen needs come back.
 *
 * Everything downstream still checks: the accept route re-reads the status and
 * the expiry, and matches the address against a real contact before it links
 * anyone to a client.
 */
export async function findInvitationByToken(
  token: string,
): Promise<InvitationRecord | null> {
  if (!token || token.length < 16) return null;

  const admin = createAdminClient();
  if (!admin) return null;

  const { data } = await admin
    .from("invitations")
    .select(
      "id, token, inviter_user_id, invitee_email, invitee_name, context_type, context_id, role_or_relationship, status, expires_at",
    )
    .eq("token", token)
    .maybeSingle();

  return (data as InvitationRecord | null) ?? null;
}

/** The inviter's name and, for a client invitation, the household and the firm. */
export async function describeInvitation(invitation: InvitationRecord) {
  const admin = createAdminClient();
  if (!admin) {
    return {
      inviterName: "A teammate",
      accountName: null as string | null,
      professionalName: null as string | null,
    };
  }

  const [{ data: inviter }, { data: client }] = await Promise.all([
    invitation.inviter_user_id
      ? admin.from("users").select("full_name, preferred_name").eq("id", invitation.inviter_user_id).maybeSingle()
      : Promise.resolve({ data: null }),
    invitation.context_type.startsWith("client_") && invitation.context_id
      ? admin.from("whitbyos_clients").select("name, workspace_id").eq("id", invitation.context_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const workspaceId = (client?.workspace_id as string | undefined) ?? null;
  const { data: workspace } = workspaceId
    ? await admin.from("workspaces").select("name").eq("id", workspaceId).maybeSingle()
    : { data: null };

  return {
    inviterName:
      (inviter?.preferred_name as string) || (inviter?.full_name as string) || "A teammate",
    accountName: (client?.name as string | null) ?? null,
    professionalName: (workspace?.name as string | null) ?? null,
  };
}
