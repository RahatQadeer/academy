-- A client's invitation status has to be visible to the team, not just to
-- whoever happened to send it.
--
-- `invitations_select` allows a row through for the inviter, its creator, or
-- the person it was addressed to. That is right for a teammate invitation —
-- it is between two people — but a client's invitation belongs to the client,
-- and any permitted professional on that account needs to see whether they are
-- Invited, Expired or in. As it stands, a colleague opening the same client
-- sees nothing at all, and a colleague resending would be working blind.
--
-- Scoped to client invitations only. A teammate invitation stays private
-- between inviter and invitee, which is what it was.
--
-- (Policies are OR'd, so this widens rather than replaces.)

drop policy if exists invitations_select_client_workspace on public.invitations;

create policy invitations_select_client_workspace on public.invitations
  for select using (
    context_type::text like 'client\_%'
    and exists (
      select 1 from public.whitbyos_clients c
       where c.id = invitations.context_id
         and public.is_workspace_member(c.workspace_id)
    )
  );
