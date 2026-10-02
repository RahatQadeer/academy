-- =====================================================================
-- Whitby — who on your team can see a conversation
-- Owner: Sabahat (whitbyos_*)
--
-- Messages lists every thread in the workspace, so a conversation about one
-- client's divorce paperwork sits in the inbox of everybody who works here,
-- whether or not they are on it. That is the right default for a small firm —
-- work does not stop because one person is away — but it is not the only
-- answer a conversation ever needs.
--
--   workspace     → anyone on your team can find it (what every existing
--                   thread has always been, so that is the default).
--   participants  → only the people on the conversation can see it, and
--                   somebody is on it because they were added to it.
--
-- This says nothing about the client side. A contact sees a conversation
-- because they are a participant of it, which is unchanged either way.
--
-- Safe to re-run.
-- =====================================================================

alter table public.whitbyos_message_threads
  add column if not exists visibility text not null default 'workspace';

do $$
begin
  alter table public.whitbyos_message_threads
    add constraint whitbyos_message_threads_visibility_check
    check (visibility in ('workspace', 'participants'));
exception
  when duplicate_object then null;
end $$;


-- =====================================================================
-- VERIFY — the column, and what every thread is set to.
-- =====================================================================
-- select visibility, count(*) from public.whitbyos_message_threads
-- group by visibility;
