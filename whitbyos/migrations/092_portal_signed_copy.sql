-- whitbyos/092 — the client's signature ends up on the paper
--
-- 073 let a client answer "signed", and that is all it did: a flag on the row,
-- a date, and the same unsigned file the firm sent out. The portal now puts the
-- signature on the document itself — typed, placed on the page, stamped into
-- the PDF — or takes back a copy the client signed by hand and scanned. Either
-- way there is a new file, and the client cannot file it:
--
--   * `documents_write` does not reach a portal client, so the original cannot
--     be archived or pointed at what replaced it;
--   * the signing columns on the new row would be the client writing their own
--     answer, which is exactly what 073 kept behind a function.
--
-- So this is the signing half of 073 with a file attached. The same checks —
-- the document is waiting on the client, and it is this client's — then the
-- round trip the Whitby side already does in `resolveDocument`: a new version
-- carrying the signed file, the original archived and pointing at it, labels
-- carried over, and the firm told.
--
-- Two columns so the firm can tell how it was signed without opening the file:
--
--   signature_signed_name  the name the signer typed, as it was stamped
--   signature_method       'typed' (placed in the portal) or 'uploaded'
--                          (downloaded, signed on paper, sent back)
--
-- Both additive and nullable; `documents` is base and nothing reading it today
-- can notice them. Safe to re-run.

alter table public.documents
  add column if not exists signature_signed_name text,
  add column if not exists signature_method text;

alter table public.documents
  drop constraint if exists documents_signature_method_check;
alter table public.documents
  add constraint documents_signature_method_check
  check (signature_method is null or signature_method in ('typed', 'uploaded'));

create or replace function public.portal_file_signed_copy(
  p_document_id uuid,
  p_file_path text,
  p_method text,
  p_signed_name text default null,
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_contact uuid;
  v_doc record;
  v_signed uuid;
  v_workspace uuid;
  v_name text := nullif(btrim(coalesce(p_signed_name, '')), '');
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
begin
  if p_method not in ('typed', 'uploaded') then
    return null;
  end if;

  -- A Storage path, which is the only thing the portal's upload writes. A link
  -- would be the client pointing the firm's record at somewhere else entirely.
  if coalesce(btrim(p_file_path), '') = '' or p_file_path ~* '^[a-z]+:' then
    return null;
  end if;

  -- Typing a name is what a typed signature is.
  if p_method = 'typed' and v_name is null then
    return null;
  end if;

  v_contact := public.portal_contact_id();
  if v_contact is null then
    return null;
  end if;

  select d.id, d.title, d.context_type, d.context_id, d.visibility, d.version,
         d.effective_date, d.expires_at, d.signature_required_from, d.signature_state
    into v_doc
    from public.documents d
   where d.id = p_document_id
   for update;

  if not found then
    return null;
  end if;

  if v_doc.signature_state is distinct from 'awaiting'
     or v_doc.signature_required_from is distinct from 'client' then
    return null;
  end if;

  if v_doc.context_type = 'client' then
    if not public.portal_is_client_of(v_doc.context_id) then
      return null;
    end if;
  elsif v_doc.context_type = 'request' then
    if not public.portal_can_see_request(v_doc.context_id) then
      return null;
    end if;
  else
    return null;
  end if;

  -- The signed copy is the document now. It carries the answer, so both sides
  -- read "Signed" off the row they are looking at rather than off an archived
  -- one neither of them can see in their main list.
  insert into public.documents
    (title, file_url, context_type, context_id, visibility, status, version,
     effective_date, expires_at, signed_date, uploaded_by_user_id,
     signature_required_from, signature_state, signature_note, signature_actioned_at,
     signature_signed_name, signature_method)
  values
    (v_doc.title, btrim(p_file_path), v_doc.context_type, v_doc.context_id, v_doc.visibility,
     'completed', coalesce(v_doc.version, 1) + 1,
     v_doc.effective_date, v_doc.expires_at, current_date, auth.uid(),
     'client', 'signed', v_note, now(),
     v_name, p_method)
  returning id into v_signed;

  -- The unsigned original is the record of what was sent out. It stays, out of
  -- the way, pointing at what replaced it — and no longer asking anybody.
  update public.documents
     set status = 'archived',
         superseded_by_document_id = v_signed,
         signature_required_from = null,
         signature_state = null,
         updated_at = now()
   where id = p_document_id;

  insert into public.document_labels (document_id, label_text, created_by_user_id)
  select v_signed, l.label_text, auth.uid()
    from public.document_labels l
   where l.document_id = p_document_id;

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
           'signature_signed',
           'A document was signed',
           v_doc.title
             || case when v_name is not null then ' — signed by ' || v_name else '' end
             || case when p_method = 'uploaded' then ' (signed copy uploaded)' else '' end,
           '/whitbyos/documents?doc=' || v_signed::text,
           'document',
           v_signed
      from public.workspace_members m
     where m.workspace_id = v_workspace
       and m.status = 'active';
  end if;

  return v_signed;
end;
$$;

revoke all on function public.portal_file_signed_copy(uuid, text, text, text, text) from public;
grant execute on function public.portal_file_signed_copy(uuid, text, text, text, text) to authenticated;
