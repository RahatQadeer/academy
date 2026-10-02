-- =====================================================================
-- Whitby — Work Plan fields from the updated Professional Figma
-- Owner: Sabahat (whitbyos_*)
--
-- The updated export adds a full Work Plans module (WP.1–WP.20). Its list and
-- detail screens show three things the schema has nowhere to put, plus one
-- status value the enum rejects.
--
--   urgency   Critical / High / Medium / Low   (WP.2, WP.17)
--   health    On Track / Needs Attention / At Risk  (WP.2, WP.17)
--   location  "London" on WP.17's Linked panel
--   status    WP.19's Edit Work Stream offers "Blocked"
--
-- `whitbyos_workstream_status` is an enum in base's 00001 migration, so rather
-- than altering a shared type this adds a checked text column alongside it —
-- the same approach 004 took for `kind`. `status` keeps its enum values;
-- `blocked` is the one state the design needs that the enum lacks.
--
-- Urgency is deliberately separate from the existing `priority` on Requests:
-- §6.6.4 uses priority for ordering Work Streams within a plan, while WP.2's
-- Urgency describes the plan as a whole.
--
-- Safe to re-run.
-- =====================================================================

-- ---- Work Plan ---------------------------------------------------------

alter table public.whitbyos_workplans
  add column if not exists urgency text not null default 'medium';

alter table public.whitbyos_workplans
  drop constraint if exists whitbyos_workplans_urgency_check;
alter table public.whitbyos_workplans
  add constraint whitbyos_workplans_urgency_check
  check (urgency in ('critical', 'high', 'medium', 'low'));

alter table public.whitbyos_workplans
  add column if not exists health text not null default 'on_track';

alter table public.whitbyos_workplans
  drop constraint if exists whitbyos_workplans_health_check;
alter table public.whitbyos_workplans
  add constraint whitbyos_workplans_health_check
  check (health in ('on_track', 'needs_attention', 'at_risk'));

alter table public.whitbyos_workplans
  add column if not exists location text;

-- Links the plan back to the Playbook it was built from (WP.17 "Linked",
-- SRS §6.5.2 — a Playbook is a starting structure, not a live template, so
-- this records provenance only and never controls the plan).
alter table public.whitbyos_workplans
  add column if not exists source_playbook_id uuid
    references public.whitbyos_playbooks (id) on delete set null;

-- ---- Work Stream -------------------------------------------------------

alter table public.whitbyos_workstreams
  add column if not exists blocked boolean not null default false;


-- =====================================================================
-- VERIFY — should return five rows.
-- =====================================================================
-- select table_name, column_name
-- from information_schema.columns
-- where table_schema = 'public'
--   and (
--     (table_name = 'whitbyos_workplans'
--       and column_name in ('urgency','health','location','source_playbook_id'))
--     or (table_name = 'whitbyos_workstreams' and column_name = 'blocked')
--   )
-- order by 1, 2;
