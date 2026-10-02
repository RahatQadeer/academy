-- =====================================================================
-- Whitby — the fields a Calendar event actually shows
-- Owner: Sabahat (whitbyos_*)
--
-- `whitbyos_calendar_events` holds a title, a start and end, what it is linked
-- to, and where it came from. Screens 8, 8.1 and 8c show three things it has
-- nowhere to put:
--
--   kind        Appointment / Meeting / Key Date   (the pill on every row)
--   attendees   "Jordan Hartwell, Alexandra Hartwell"
--   location    "US Embassy, London"
--
-- `kind` is the one that carries meaning rather than decoration: SRS §6.7.7
-- separates a Key Date — a date that materially drives a Workstream — from an
-- ordinary appointment, and says a Key Date can link to the Calendar without
-- every due date becoming a calendar event. The pill is how that distinction
-- reaches the screen.
--
-- Attendees as text rather than a join table. The export shows a plain list,
-- and the people on an event are frequently not records in this system at all
-- — an embassy officer, a school registrar. Forcing each into `contacts` to
-- put a name on an appointment would be the wrong trade.
--
-- Plain text with a check constraint, as 004, 007 and 012 all do, rather than
-- an enum type in base's 00001.
--
-- Safe to re-run.
-- =====================================================================

alter table public.whitbyos_calendar_events
  add column if not exists kind text not null default 'appointment';

alter table public.whitbyos_calendar_events
  drop constraint if exists whitbyos_calendar_events_kind_check;
alter table public.whitbyos_calendar_events
  add constraint whitbyos_calendar_events_kind_check
  check (kind in ('appointment', 'meeting', 'key_date'));

alter table public.whitbyos_calendar_events
  add column if not exists attendees text;

alter table public.whitbyos_calendar_events
  add column if not exists location text;

create index if not exists whitbyos_calendar_events_workspace_start_idx
  on public.whitbyos_calendar_events (workspace_id, start_at);


-- =====================================================================
-- VERIFY — should return three rows: attendees, kind, location
-- =====================================================================
-- select column_name, data_type
-- from information_schema.columns
-- where table_schema = 'public'
--   and table_name = 'whitbyos_calendar_events'
--   and column_name in ('kind', 'attendees', 'location')
-- order by 1;
