-- 073 — the client's half of the signing round trip could not be written.
--
-- `documents_write` is `(uploaded_by_user_id = auth.uid()) OR
-- shares_workspace_with(uploaded_by_user_id)`. A portal client is neither: they
-- can read a `client_visible` document through `documents_select_client` and
-- could not change one byte of it. So Sign and Decline reached the update,
-- were refused by row-level security, and came back as "that could not be
-- saved" — the round trip was only ever going to work in one direction.
--
-- Widening `documents_write` is the wrong fix twice over: it would let a client
-- edit a document's title, its visibility and its status, and RLS cannot
-- restrict which columns a policy allows. So the two writes a client is
-- entitled to make are functions instead, each doing exactly one thing and
-- checking its own right to do it.
--
-- Definer, and deliberately: the point is to act above `documents_write` while
-- allowing strictly less than it. Each function re-checks that the caller is
-- the client of this document, so the privilege buys one specific write and
-- not a way around the policy.
--
-- The notice to the firm goes out from inside the same function. A client
-- cannot insert into `whitbyos_notifications` either, and an answer nobody is
-- told about is half an answer.

create or replace function public.portal_answer_signature(
  p_document_id uuid,
  p_outcome text,
  p_note text default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_contact uuid;
  v_doc record;
  v_workspace uuid;
begin
  if p_outcome not in ('signed', 'declined') then
    return false;
  end if;

  v_contact := public.portal_contact_id();
  if v_contact is null then
    return false;
  end if;

  select d.id, d.title, d.context_type, d.context_id,
         d.signature_required_from, d.signature_state
    into v_doc
    from public.documents d
   where d.id = p_document_id;

  if not found then
    return false;
  end if;

  -- Being asked is the whole of the permission. A document sent to the firm,
  -- or one nobody has asked about, is not this client's to answer.
  if v_doc.signature_state is distinct from 'awaiting'
     or v_doc.signature_required_from is distinct from 'client' then
    return false;
  end if;

  -- And it has to be theirs. The same two questions `documents_select_client`
  -- asks, asked again here rather than assumed from the read that got them to
  -- the button.
  if v_doc.context_type = 'client' then
    if not public.portal_is_client_of(v_doc.context_id) then
      return false;
    end if;
  elsif v_doc.context_type = 'request' then
    if not public.portal_can_see_request(v_doc.context_id) then
      return false;
    end if;
  else
    return false;
  end if;

  update public.documents
     set signature_state = p_outcome,
         signature_note = nullif(btrim(coalesce(p_note, '')), ''),
         signature_actioned_at = now(),
         -- Only a signature dates the document. A refusal answers the asking;
         -- it is not a fact about the paper.
         signed_date = case when p_outcome = 'signed' then current_date else signed_date end,
         status = case when p_outcome = 'signed' then 'completed'::document_status else status end,
         updated_at = now()
   where id = p_document_id;

  select c.workspace_id into v_workspace
    from public.whitbyos_clients c
   where c.id = case
                  when v_doc.context_type = 'client' then v_doc.context_id
                  else (select r.client_id from public.whitbyos_requests r where r.id = v_doc.context_id)
                end;

  if v_workspace is not null then
    insert into public.whitbyos_notifications
      (workspace_id, recipient_user_id, recipient_contact_id, kind, title, body, href, entity_type, entity_id)
    select v_workspace,
           m.user_id,
           null,
           case when p_outcome = 'signed' then 'signature_signed' else 'signature_declined' end,
           case when p_outcome = 'signed' then 'A document was signed' else 'A document was declined' end,
           case when nullif(btrim(coalesce(p_note, '')), '') is null
                then v_doc.title
                else v_doc.title || ' — ' || btrim(p_note) end,
           '/whitbyos/documents?doc=' || p_document_id::text,
           'document',
           p_document_id
      from public.workspace_members m
     where m.workspace_id = v_workspace
       and m.status = 'active';
  end if;

  return true;
end;
$$;

create or replace function public.portal_request_signature(p_document_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_contact uuid;
  v_doc record;
  v_workspace uuid;
begin
  v_contact := public.portal_contact_id();
  if v_contact is null then
    return false;
  end if;

  select d.id, d.title, d.file_url, d.context_type, d.context_id, d.signature_state
    into v_doc
    from public.documents d
   where d.id = p_document_id;

  if not found or coalesce(btrim(v_doc.file_url), '') = '' then
    return false;
  end if;

  -- Already in the middle of being asked about: asking again would be a second
  -- ask about one document and a second notice about one of them.
  if v_doc.signature_state = 'awaiting' then
    return false;
  end if;

  if v_doc.context_type = 'client' then
    if not public.portal_is_client_of(v_doc.context_id) then
      return false;
    end if;
  elsif v_doc.context_type = 'request' then
    if not public.portal_can_see_request(v_doc.context_id) then
      return false;
    end if;
  else
    return false;
  end if;

  update public.documents
     set signature_required_from = 'professional',
         signature_state = 'awaiting',
         signature_note = null,
         signature_actioned_at = null,
         updated_at = now()
   where id = p_document_id;

  select c.workspace_id into v_workspace
    from public.whitbyos_clients c
   where c.id = case
                  when v_doc.context_type = 'client' then v_doc.context_id
                  else (select r.client_id from public.whitbyos_requests r where r.id = v_doc.context_id)
                end;

  if v_workspace is not null then
    insert into public.whitbyos_notifications
      (workspace_id, recipient_user_id, recipient_contact_id, kind, title, body, href, entity_type, entity_id)
    select v_workspace, m.user_id, null,
           'signature_requested',
           'A document needs your signature',
           v_doc.title,
           '/whitbyos/documents?tab=action&doc=' || p_document_id::text,
           'document',
           p_document_id
      from public.workspace_members m
     where m.workspace_id = v_workspace
       and m.status = 'active';
  end if;

  return true;
end;
$$;

revoke all on function public.portal_answer_signature(uuid, text, text) from public;
revoke all on function public.portal_request_signature(uuid) from public;
grant execute on function public.portal_answer_signature(uuid, text, text) to authenticated;
grant execute on function public.portal_request_signature(uuid) to authenticated;
