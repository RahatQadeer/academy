-- 071 — which way an email went.
--
-- The sync only ever asked Gmail for `from:<allowed>`, so Whitby saw what a
-- client sent the professional and never what the professional sent back. Half
-- a conversation is a poor thing to draft from: what was promised is as much
-- context as what was asked for.
--
-- Reading both directions means a row can no longer be described by
-- `from_email` alone — that column stays truthful about who wrote the message,
-- and this says whether the message came in or went out, so a screen can print
-- "from Leia" or "to Leia" and the drafter can tell a request from a reply.
--
-- Defaults to 'incoming': that is what every row written before this migration
-- was, by construction, since nothing else could be fetched.
--
-- Safe to re-run.

alter table public.whitbyos_gmail_extracts
  add column if not exists direction text not null default 'incoming';

alter table public.whitbyos_gmail_extracts
  drop constraint if exists whitbyos_gmail_extracts_direction_check;

alter table public.whitbyos_gmail_extracts
  add constraint whitbyos_gmail_extracts_direction_check
  check (direction in ('incoming', 'outgoing'));
