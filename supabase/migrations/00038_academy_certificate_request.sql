-- Learner certificate request: durable flag on the credential so UI and admin
-- queue stay in sync after refresh (not only an audit_log row).

alter table public.academy_credentials
  add column if not exists certificate_requested_at timestamptz;

comment on column public.academy_credentials.certificate_requested_at is
  'When the learner requested certificate issuance; null until they click Request.';

create index if not exists academy_credentials_certificate_requested_at_idx
  on public.academy_credentials (certificate_requested_at desc nulls last)
  where certificate_requested_at is not null and status = 'credential_review';

create or replace function public.academy_request_certificate(p_credential_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_row public.academy_credentials%rowtype;
begin
  if auth.uid() is null then
    return jsonb_build_object('status', 'unavailable', 'reason', 'unauthenticated');
  end if;

  if p_credential_id is null then
    return jsonb_build_object('status', 'unavailable', 'reason', 'not_found');
  end if;

  select *
  into v_row
  from public.academy_credentials
  where id = p_credential_id
  for update;

  if v_row.id is null then
    return jsonb_build_object('status', 'unavailable', 'reason', 'not_found');
  end if;

  if v_row.user_id is distinct from auth.uid() then
    return jsonb_build_object('status', 'unavailable', 'reason', 'not_found');
  end if;

  if v_row.status = 'awarded' then
    return jsonb_build_object('status', 'unavailable', 'reason', 'already_awarded');
  end if;

  -- Keep status in sync with assignments / completion before accepting the request.
  perform public.academy_sync_credential_progress(p_credential_id);

  select *
  into v_row
  from public.academy_credentials
  where id = p_credential_id
  for update;

  if v_row.status is distinct from 'credential_review' then
    return jsonb_build_object('status', 'unavailable', 'reason', 'not_ready');
  end if;

  if not public.academy_credential_assignments_ready(p_credential_id) then
    return jsonb_build_object('status', 'unavailable', 'reason', 'assignments_pending');
  end if;

  if v_row.certificate_requested_at is not null then
    return jsonb_build_object(
      'status', 'ok',
      'already_requested', true,
      'requested_at', v_row.certificate_requested_at
    );
  end if;

  update public.academy_credentials
  set certificate_requested_at = now()
  where id = p_credential_id
  returning * into v_row;

  insert into public.audit_log (
    actor_user_id,
    entity_type,
    entity_id,
    action,
    reason,
    previous_value,
    new_value
  )
  values (
    auth.uid(),
    'academy_credential',
    p_credential_id,
    'request',
    'Learner requested certificate issuance',
    jsonb_build_object('status', 'credential_review'),
    jsonb_build_object('status', 'credential_review', 'requested', true)
  );

  return jsonb_build_object(
    'status', 'ok',
    'already_requested', false,
    'requested_at', v_row.certificate_requested_at
  );
end;
$$;

revoke all on function public.academy_request_certificate(uuid) from public, anon;
grant execute on function public.academy_request_certificate(uuid) to authenticated, service_role;

-- Backfill any requests that were only recorded in audit_log.
update public.academy_credentials c
set certificate_requested_at = a.first_requested_at
from (
  select entity_id, min(created_at) as first_requested_at
  from public.audit_log
  where entity_type = 'academy_credential'
    and action = 'request'
  group by entity_id
) a
where c.id = a.entity_id
  and c.certificate_requested_at is null
  and c.status = 'credential_review';
