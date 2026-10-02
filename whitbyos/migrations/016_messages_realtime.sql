-- Live messages.
--
-- Neither the SRS nor the export asks for this: there is no typing indicator,
-- no online dot, no delivered or seen state anywhere in the design. But a
-- conversation that only updates when you reload is not really a conversation,
-- so messages are published to Realtime and the screen refreshes itself.
--
-- No socket server is involved. Supabase Realtime carries Postgres changes over
-- its own WebSocket, and RLS still applies to every row that goes out — a
-- subscriber is sent only what they could already have read.

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'whitbyos_messages'
  ) then
    alter publication supabase_realtime add table public.whitbyos_messages;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'whitbyos_message_threads'
  ) then
    alter publication supabase_realtime add table public.whitbyos_message_threads;
  end if;
end
$$;
