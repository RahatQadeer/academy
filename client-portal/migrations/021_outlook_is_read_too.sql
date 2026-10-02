-- =====================================================================
-- Client Portal 021 — Outlook Mail is read, not only held
-- Owner: Rohail (client_portal_*). Sign-off: none — every object here
-- belongs to this module's own namespace.
--
-- `018` built five tables for a client's own connections and only Google was
-- ever read out of them. Outlook Mail and Outlook Calendar connected, stored a
-- grant, and stopped — deliberately, because Whitby's own Outlook does the
-- same and a portal that read a mailbox Whitby could not would be inventing
-- behaviour the professional side knows nothing about.
--
-- That is no longer what the product wants: a client who keeps their life in
-- Outlook gets the same Calendar and the same email summaries as one who keeps
-- it in Google.
--
-- WHY THE CALENDAR NEEDS NOTHING
--
-- `client_portal_calendar_events` was keyed on (contact_id, provider,
-- external_event_id) from the start, so Outlook's events land beside Google's
-- with no change at all. Only the mail tables were written as though Gmail
-- were the only mailbox there would ever be.
--
-- WHAT CHANGES
--
-- `provider` on the two mail tables, and both unique indexes re-keyed to
-- include it. Without that, a Graph message id and a Gmail message id compete
-- for one row, and a person chosen on Gmail cannot be chosen on Outlook
-- separately — which is what the two screens now ask for.
--
-- THE COLUMN NAMES STAY GMAIL'S
--
-- `gmail_message_id` holds a Graph id for an Outlook row, and the tables keep
-- their `_gmail_` names. Renaming four objects to say `mail` would touch every
-- read in `client-portal/lib/integrations/` for no behaviour, and a rename is
-- the one migration that cannot be rolled forward past a deploy still running
-- the old code. The names are wrong and the comment says so; the data is
-- right.
--
-- Safe to re-run: every statement guards itself, one transaction.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 1. Whose mail may be read, per mailbox.
--
-- Defaulted to 'gmail' because every row that exists today was chosen on the
-- Gmail screen, which was the only screen there was.
-- ---------------------------------------------------------------------
alter table public.client_portal_gmail_sources
  add column if not exists provider text not null default 'gmail';

do $$
begin
  alter table public.client_portal_gmail_sources
    add constraint client_portal_gmail_sources_provider_chk
    check (provider in ('gmail', 'outlook_mail'));
exception
  when duplicate_object then null;
end $$;

drop index if exists public.client_portal_gmail_sources_email_idx;

create unique index if not exists client_portal_gmail_sources_provider_email_idx
  on public.client_portal_gmail_sources (contact_id, provider, email);

-- ---------------------------------------------------------------------
-- 2. What a read message left behind, per mailbox.
--
-- The same address read in both mailboxes is two rows, not one: the message
-- ids are different namespaces and the same conversation seen from Gmail and
-- from Outlook is two readings of two copies.
-- ---------------------------------------------------------------------
alter table public.client_portal_gmail_extracts
  add column if not exists provider text not null default 'gmail';

do $$
begin
  alter table public.client_portal_gmail_extracts
    add constraint client_portal_gmail_extracts_provider_chk
    check (provider in ('gmail', 'outlook_mail'));
exception
  when duplicate_object then null;
end $$;

drop index if exists public.client_portal_gmail_extracts_message_idx;

create unique index if not exists client_portal_gmail_extracts_provider_message_idx
  on public.client_portal_gmail_extracts (contact_id, provider, gmail_message_id);

-- The screen reads one mailbox at a time now, so the ordering index it scans
-- leads with the provider.
drop index if exists public.client_portal_gmail_extracts_contact_idx;

create index if not exists client_portal_gmail_extracts_provider_contact_idx
  on public.client_portal_gmail_extracts (contact_id, provider, received_at desc);

commit;

-- =====================================================================
-- VERIFY — `provider` on both, defaulting to 'gmail', and the three new
-- indexes carrying it.
-- =====================================================================
-- select table_name, column_name, column_default, is_nullable
-- from information_schema.columns
-- where table_schema = 'public'
--   and table_name in ('client_portal_gmail_sources', 'client_portal_gmail_extracts')
--   and column_name = 'provider';
--
-- select indexname from pg_indexes
-- where schemaname = 'public'
--   and tablename in ('client_portal_gmail_sources', 'client_portal_gmail_extracts')
-- order by indexname;
