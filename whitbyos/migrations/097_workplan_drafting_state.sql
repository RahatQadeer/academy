-- A plan that is still being written.
--
-- Drafting a Work Plan is two model calls and a save, which is a minute or
-- two — and the professional was made to sit and watch it, on a screen that
-- could not be left without losing the work. The client asked for the other
-- arrangement: say "come back in a minute or two", and get on with the day.
--
-- For that the plan has to exist before it is finished, so there is somewhere
-- to come back to, and the row has to be able to say which it is. `status`
-- cannot: 'draft' there means a plan nobody has activated yet, which is what
-- this becomes once it is written.
--
--   drafting   the model is being asked; the page says come back
--   ready      written, and the plan reads normally
--   failed     the drafting did not survive; `drafting_error` says why
--
-- Null is every plan that already exists and every one made by hand, which
-- were never in this state and read as ready.
alter table public.whitbyos_workplans
  add column if not exists drafting_state text
    check (drafting_state in ('drafting', 'ready', 'failed')),
  add column if not exists drafting_error text,
  -- When the asking started, so a job the server never finished — a deploy
  -- mid-draft, a function killed — can be told from one still running.
  add column if not exists drafting_started_at timestamptz;

create index if not exists whitbyos_workplans_drafting_idx
  on public.whitbyos_workplans (drafting_state)
  where drafting_state = 'drafting';

-- The page waiting on it re-reads itself; live rows mean it can stop polling
-- the moment the draft lands rather than up to a poll later.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      alter publication supabase_realtime add table public.whitbyos_workplans;
    exception
      when duplicate_object then null;
    end;
  end if;
end
$$;
