-- 064 — reporting AI usage to Stripe without ever charging for it twice.
--
-- 063 left a watermark, `whitbyos_ai_meter_state.reported_cents`, advanced only
-- after Stripe accepted a report. That is safe against losing usage but not
-- against double-charging, because the amount sent is a *delta*:
--
--   owed 3, reported 0  -> send 3. Stripe accepts. The watermark write fails.
--   more usage arrives, owed is now 5.
--   retry: owed 5 - reported 0 = send 5. Stripe has now been told 3 + 5 = 8.
--
-- The delta has to be fixed at the moment it is claimed, not recomputed on
-- every attempt. So a report is written down before it is sent, as a closed
-- range of cumulative cents, and a retry re-sends *that* range rather than
-- whatever the total has since become.
--
-- `identifier` is deterministic and unique. Stripe deduplicates meter events by
-- it for a rolling 24 hours, so a retry of a report that did land is ignored on
-- their side too. That is the second line: the first is that a pending row is
-- retried rather than replaced, so the same cents can never be claimed twice.
--
-- The usage rows stay the source of truth. This table records only what has
-- been told to Stripe about them, and every figure in it is derived by summing
-- `whitbyos_ai_usage.charge_micros`.
--
-- Re-runnable. One transaction.

begin;

create table if not exists public.whitbyos_ai_meter_reports (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,

  -- The closed range of cumulative whole cents this report covers. Fixed when
  -- the report is created and never recomputed, which is what makes a retry
  -- send the same thing rather than an overlapping one.
  from_cents bigint not null,
  to_cents bigint not null,
  units integer not null,

  -- What Stripe deduplicates on. Derived from the range, so a retry of this
  -- row produces the identical value.
  identifier text not null,

  -- pending until Stripe has accepted it. Only then does the watermark move.
  status text not null default 'pending',
  attempts integer not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  sent_at timestamptz,

  constraint whitbyos_ai_meter_reports_status_chk
    check (status in ('pending', 'sent')),
  constraint whitbyos_ai_meter_reports_range_chk
    check (to_cents > from_cents and units = to_cents - from_cents)
);

-- Two reports can never claim the same range, whatever races.
create unique index if not exists whitbyos_ai_meter_reports_identifier_idx
  on public.whitbyos_ai_meter_reports (identifier);

-- At most one report in flight per workspace. The retry path finds it by this,
-- and the partial unique index is what stops a second one being opened beside
-- it while the first is unresolved.
create unique index if not exists whitbyos_ai_meter_reports_pending_idx
  on public.whitbyos_ai_meter_reports (workspace_id)
  where status = 'pending';

alter table public.whitbyos_ai_meter_reports enable row level security;

drop policy if exists whitbyos_ai_meter_reports_read on public.whitbyos_ai_meter_reports;
create policy whitbyos_ai_meter_reports_read on public.whitbyos_ai_meter_reports
  for select using (public.is_workspace_member(workspace_id));

-- ---------------------------------------------------------------------------
-- The total owed, from the usage rows themselves.
--
-- A function rather than a running counter, because the usage rows are the
-- source of truth and a counter beside them is a second one that can drift.
-- PostgREST refuses aggregate selects on this project, so the sum happens here
-- and crosses the wire once instead of pulling every row into the app to add
-- them up — which is also what stops this getting slower every month.
--
-- Only whole cents are ever owed: the meter bills a cent per unit, and the
-- remainder stays in the table to be carried into the next report.
-- ---------------------------------------------------------------------------

create or replace function public.whitbyos_ai_owed_cents(p_workspace_id uuid)
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select floor(coalesce(sum(charge_micros), 0) / 10000.0)::bigint
  from public.whitbyos_ai_usage
  where workspace_id = p_workspace_id
    and charge_micros is not null;
$$;

commit;
