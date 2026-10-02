-- Active session list / revoke for Settings → Security.
-- Uses auth.sessions (Supabase Auth source of truth). No partner_* duplicate table.
-- Callers: authenticated users only; each function is scoped to auth.uid().

-- ---------------------------------------------------------------------------
-- list_my_auth_sessions
-- Returns the caller's sessions. is_current matches JWT claim session_id.
-- ---------------------------------------------------------------------------
create or replace function public.list_my_auth_sessions()
returns table (
  id uuid,
  created_at timestamptz,
  updated_at timestamptz,
  refreshed_at timestamptz,
  user_agent text,
  ip text,
  is_current boolean
)
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  current_sid uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  begin
    current_sid := nullif(auth.jwt() ->> 'session_id', '')::uuid;
  exception
    when others then
      current_sid := null;
  end;

  return query
  select
    s.id,
    s.created_at,
    s.updated_at,
    s.refreshed_at,
    s.user_agent,
    s.ip::text,
    (current_sid is not null and s.id = current_sid) as is_current
  from auth.sessions s
  where s.user_id = auth.uid()
  order by coalesce(s.refreshed_at, s.updated_at, s.created_at) desc nulls last;
end;
$$;

revoke all on function public.list_my_auth_sessions() from public;
grant execute on function public.list_my_auth_sessions() to authenticated;

-- ---------------------------------------------------------------------------
-- revoke_my_auth_session
-- Ends one session owned by the caller. Returns true if a row was deleted.
-- ---------------------------------------------------------------------------
create or replace function public.revoke_my_auth_session(p_session_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  deleted_count integer;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if p_session_id is null then
    raise exception 'session_id is required';
  end if;

  delete from auth.sessions s
  where s.id = p_session_id
    and s.user_id = auth.uid();

  get diagnostics deleted_count = row_count;
  return deleted_count > 0;
end;
$$;

revoke all on function public.revoke_my_auth_session(uuid) from public;
grant execute on function public.revoke_my_auth_session(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- revoke_other_auth_sessions
-- Ends every session for the caller except the current JWT session.
-- ---------------------------------------------------------------------------
create or replace function public.revoke_other_auth_sessions()
returns integer
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  current_sid uuid;
  deleted_count integer;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  begin
    current_sid := nullif(auth.jwt() ->> 'session_id', '')::uuid;
  exception
    when others then
      current_sid := null;
  end;

  if current_sid is null then
    raise exception 'Current session_id is missing from the JWT';
  end if;

  delete from auth.sessions s
  where s.user_id = auth.uid()
    and s.id is distinct from current_sid;

  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

revoke all on function public.revoke_other_auth_sessions() from public;
grant execute on function public.revoke_other_auth_sessions() to authenticated;
