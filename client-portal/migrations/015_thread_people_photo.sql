-- Portal 015 — the person you are talking to has a face
--
-- `portal_thread_people` (004) returns a name and nothing else, so every avatar
-- in the portal's Messages is a pair of initials — including the professional's,
-- who has had a photo on their account the whole time.
--
-- The column is added to the function rather than read directly, because a
-- client cannot select from `public.users` at all: the portal reaches everything
-- about the firm through security-definer functions, and this is the one that
-- already answers "who is on this thread".
--
-- Only a user's photo. A contact's is not a column anywhere — the portal writes
-- it to `avatars/<contact id>/photo` and the path's existence is the record —
-- so the reader signs their own on the way out, which is a thing SQL cannot do.

-- A changed OUT signature cannot go through `create or replace`.
drop function if exists public.portal_thread_people(uuid[]);

create function public.portal_thread_people(p_thread_ids uuid[])
returns table (
  thread_id uuid,
  party_type text,
  party_id uuid,
  display_name text,
  photo_url text,
  is_participant boolean
)
language sql stable security definer set search_path = public as $$
  with mine as (
    select t.id
    from unnest(coalesce(p_thread_ids, '{}'::uuid[])) as t(id)
    where public.portal_in_thread(t.id)
  ),
  parties as (
    select mp.thread_id, mp.participant_type as party_type,
           mp.participant_id as party_id, true as is_participant
    from public.whitbyos_message_participants mp
    join mine on mine.id = mp.thread_id
    where mp.removed_at is null

    union

    select m.thread_id, m.sender_type, m.sender_id, false
    from public.whitbyos_messages m
    join mine on mine.id = m.thread_id
    where m.status = 'sent'
      and (
        public.portal_thread_history_from(m.thread_id) is null
        or m.created_at >= public.portal_thread_history_from(m.thread_id)
      )
  ),
  merged as (
    -- A person on the thread who has also written to it arrives once from each
    -- branch of the union; the roster fact is the one that matters.
    --
    -- Every reference below is qualified. `returns table` puts `thread_id`,
    -- `party_type` and `party_id` in scope as output parameters, so a bare
    -- column of the same name is ambiguous and the function will not compile.
    select pa.thread_id, pa.party_type, pa.party_id,
           bool_or(pa.is_participant) as is_participant
    from parties pa
    group by pa.thread_id, pa.party_type, pa.party_id
  )
  select p.thread_id,
         p.party_type,
         p.party_id,
         case p.party_type
           when 'user' then coalesce(
             nullif(btrim(u.preferred_name), ''),
             nullif(btrim(u.full_name), ''),
             'Your team'
           )
           when 'contact' then coalesce(
             nullif(btrim(c.preferred_name), ''),
             nullif(btrim(concat_ws(' ', c.first_name, c.last_name)), ''),
             'Member'
           )
           when 'company' then coalesce(nullif(btrim(co.name), ''), 'Provider')
           else 'Unknown'
         end as display_name,
         case p.party_type
           when 'user' then nullif(btrim(u.avatar_url), '')
           else null
         end as photo_url,
         p.is_participant
    from merged p
    left join public.users u on p.party_type = 'user' and u.id = p.party_id
    left join public.contacts c on p.party_type = 'contact' and c.id = p.party_id
    left join public.companies co on p.party_type = 'company' and co.id = p.party_id;
$$;

revoke all on function public.portal_thread_people(uuid[]) from public, anon;
grant execute on function public.portal_thread_people(uuid[]) to authenticated;
