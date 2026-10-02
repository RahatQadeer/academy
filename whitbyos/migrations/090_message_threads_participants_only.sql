-- =====================================================================
-- Whitby — a conversation belongs to the people in it
-- Owner: Sabahat (whitbyos_*)
--
-- 088 made "who can see this" a choice, with "everyone on your team" as the
-- default because that is how Messages had always behaved: the inbox listed
-- every thread in the workspace, whether or not you were on it.
--
-- That default was the bug, not the feature. A conversation is for the people
-- who were put in it — they read it and they answer in it — and everybody else
-- has their own. A teammate who was not added has no more business in a group
-- than they have in somebody's direct messages, and a setting that has to be
-- found and changed to stop that is a setting nobody finds in time.
--
-- So the choice goes and the rule is one rule: you see a conversation because
-- you are on it. `listThreads` and `getThread` both ask, with one exception
-- that is not an exception — a thread a client started from the portal is
-- addressed to the firm and has no professional on it at all, so it stays
-- visible to the team until somebody opens it and is joined to it.
--
-- Safe to re-run.
-- =====================================================================

alter table public.whitbyos_message_threads
  drop constraint if exists whitbyos_message_threads_visibility_check;

alter table public.whitbyos_message_threads
  drop column if exists visibility;


-- =====================================================================
-- VERIFY — the column is gone.
-- =====================================================================
-- select column_name from information_schema.columns
-- where table_name = 'whitbyos_message_threads';
