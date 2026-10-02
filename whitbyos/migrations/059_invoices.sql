-- 059 — invoices, so the client's Billing screen has something real behind it.
--
-- There is no invoice table anywhere in the shared schema: not in base, not
-- `whitbyos_*`, not `client_portal_*`. No .sql file in any of the three
-- migration folders contains the word. The Client Portal's Billing screen has
-- therefore been drawing fixtures since it was built, behind an honest banner.
--
-- WHY A TABLE HERE RATHER THAN QUICKBOOKS
-- `client-portal/lib/data/billing.ts` records the original intent: invoices
-- live in QuickBooks and are read through an adapter, and a native table would
-- fork a data model the SRS says must stay unified. That reasoning held while
-- nobody was authoring invoices. The professional now composes and sends one,
-- which means authoring it in this app, and QuickBooks cannot host that today:
-- Whitby is not registered as an app with Intuit and no credentials exist, so
-- nothing could be demonstrated or tested. The table is the source of truth and
-- QuickBooks becomes a sync target, which is the direction that keeps working
-- if the integration never lands.
--
-- WHAT IS IN HERE
-- 1. `whitbyos_invoices` — one invoice, with `sent_at` as the gate that decides
--    whether the client may see it at all.
-- 2. `whitbyos_invoice_lines` — what the invoice is actually for. A single
--    amount would have made "compose an invoice" mean "type one number", and
--    adding detail later is the expensive change, not the cheap one.
-- 3. `whitbyos_invoice_counters` and `whitbyos_next_invoice_number()`, so two
--    invoices raised in the same instant cannot collide on a number.
-- 4. `_staff` and `_client` policies on both tables.
--
-- Re-runnable: every object is `if not exists`, every policy is dropped by name
-- first, and the whole file is one transaction, so a failure leaves nothing
-- behind.

begin;

-- ---------------------------------------------------------------------------
-- 1. Numbering
--
-- A count of existing rows would hand the same number to two invoices raised at
-- the same instant, and a unique index would then fail the second one after the
-- professional had already written it. So the number comes from a counter row
-- claimed by the upsert itself: `on conflict do update` takes a row lock, and a
-- concurrent caller waits for it rather than reading a stale value.
-- ---------------------------------------------------------------------------

create table if not exists public.whitbyos_invoice_counters (
  workspace_id uuid primary key references public.workspaces(id) on delete cascade,
  last_number bigint not null default 0
);

create or replace function public.whitbyos_next_invoice_number(p_workspace_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  n bigint;
begin
  insert into public.whitbyos_invoice_counters (workspace_id, last_number)
  values (p_workspace_id, 1)
  on conflict (workspace_id) do update
    set last_number = public.whitbyos_invoice_counters.last_number + 1
  returning last_number into n;

  -- Padded so a workspace's invoices sort correctly as text, which is how
  -- every screen and every export will order them.
  return 'INV-' || lpad(n::text, 4, '0');
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. The invoice
--
-- Money is integer cents throughout. `currency` is per invoice rather than
-- assumed, because the portal's BillingSummary carries one and no screen may
-- hardcode a symbol.
--
-- THE LIFECYCLE IS TWO TIMESTAMPS, NOT A STATUS COLUMN.
-- `sent_at` and `paid_at` are facts about what happened; a status column beside
-- them is the same information written twice and free to drift from it. Draft
-- is `sent_at is null`, which is also exactly what the client policy tests, so
-- "exists" cannot quietly come to mean "visible". The portal's four-way
-- InvoiceStatus (paid / overdue / due / scheduled) is derived from these plus
-- the dates, in one place, on the read.
-- ---------------------------------------------------------------------------

create table if not exists public.whitbyos_invoices (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  client_id uuid not null references public.whitbyos_clients(id) on delete cascade,
  -- Optional: the portal renders `requestTitle` beside an invoice when the work
  -- it bills for is a Request the client can already see.
  request_id uuid references public.whitbyos_requests(id) on delete set null,

  number text not null,
  description text,

  -- Kept in step with the lines by trigger below, never written by hand.
  amount_cents bigint not null default 0,
  currency text not null default 'USD',

  -- The date the invoice is dated, which is not the date it was sent: an
  -- invoice may be composed today and issued at the start of next month, and
  -- the portal shows that as "scheduled".
  issued_at date not null default current_date,
  due_at date not null,

  sent_at timestamptz,
  paid_at timestamptz,
  -- How payment arrived, recorded when it is marked paid. Free text: this is a
  -- note for the professional, not a payment integration.
  paid_note text,

  -- Whether a notice was owed to the client when this was sent, and when it
  -- was raised. See the note in section 5.
  notified_at timestamptz,

  created_by_user_id uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- The backstop behind the counter. If numbering is ever bypassed, a collision
-- fails loudly here rather than producing two invoices called INV-0007.
create unique index if not exists whitbyos_invoices_number_idx
  on public.whitbyos_invoices (workspace_id, number);

create index if not exists whitbyos_invoices_client_idx
  on public.whitbyos_invoices (client_id, sent_at, due_at);

create index if not exists whitbyos_invoices_workspace_idx
  on public.whitbyos_invoices (workspace_id, created_at desc);

-- ---------------------------------------------------------------------------
-- 3. The lines
--
-- `amount_cents` is generated rather than written, so a line's total can never
-- disagree with the quantity and rate it is shown next to. Quantity is numeric
-- so a line can bill 2.5 hours; the product is rounded to whole cents at the
-- line, which is where a person can see it, rather than accumulating fractions
-- across the invoice.
-- ---------------------------------------------------------------------------

create table if not exists public.whitbyos_invoice_lines (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.whitbyos_invoices(id) on delete cascade,
  -- Explicit, because the order a professional wrote the lines in is part of
  -- the document and `created_at` ties when two are added in one save.
  position integer not null default 0,
  description text not null,
  quantity numeric(12, 2) not null default 1,
  unit_amount_cents bigint not null default 0,
  amount_cents bigint generated always as
    (round(quantity * unit_amount_cents)::bigint) stored,
  created_at timestamptz not null default now()
);

create index if not exists whitbyos_invoice_lines_invoice_idx
  on public.whitbyos_invoice_lines (invoice_id, position);

-- ---------------------------------------------------------------------------
-- 4. The total follows the lines
--
-- Recomputed by the database rather than by whichever action happened to edit a
-- line, because the total is what the client is asked to pay and an action that
-- forgets to recompute it would be a silent billing error. Left SECURITY
-- INVOKER: the only writers of lines are staff, who can already update the
-- invoice under their own policy, so this needs no elevated rights.
-- ---------------------------------------------------------------------------

create or replace function public.whitbyos_invoice_total()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  target uuid := coalesce(new.invoice_id, old.invoice_id);
begin
  update public.whitbyos_invoices
     set amount_cents = coalesce(
           (select sum(l.amount_cents)
              from public.whitbyos_invoice_lines l
             where l.invoice_id = target), 0),
         updated_at = now()
   where id = target;

  return null;
end;
$$;

drop trigger if exists whitbyos_invoice_lines_total on public.whitbyos_invoice_lines;
create trigger whitbyos_invoice_lines_total
  after insert or update or delete on public.whitbyos_invoice_lines
  for each row execute function public.whitbyos_invoice_total();

-- ---------------------------------------------------------------------------
-- 5. Telling the client
--
-- `client_portal_notification_prefs` already exists, and the portal already
-- offers `invoice_payment_event` as one of its nine events, so no new event key
-- is needed. What does not exist anywhere in this repo is a way to send a
-- client an email: the only outbound mail is Supabase's own auth links. So the
-- send path reads the preference and writes a `whitbyos_notifications` row
-- addressed to the contact — that table already carries `recipient_contact_id`
-- and already has a policy letting a portal login read what is addressed to
-- them (whitbyos/052) — and stamps `notified_at` on the invoice. Nothing is
-- emailed, and nothing pretends to be.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- 6. Row-level security
--
-- `_staff` for the workspace, `_client` for the portal. Postgres OR-combines
-- permissive policies, so neither suffix touches the other's rows.
--
-- The client side is SELECT only and doubly narrowed: to the accounts this
-- login is actually a member of, through the portal's own resolver, and to
-- invoices that have been sent. A draft is unreachable by any query a client
-- can make, not merely absent from the screen that renders them.
-- ---------------------------------------------------------------------------

alter table public.whitbyos_invoices enable row level security;
alter table public.whitbyos_invoice_lines enable row level security;
alter table public.whitbyos_invoice_counters enable row level security;

drop policy if exists whitbyos_invoices_staff on public.whitbyos_invoices;
create policy whitbyos_invoices_staff on public.whitbyos_invoices
  for all
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

drop policy if exists whitbyos_invoices_select_client on public.whitbyos_invoices;
create policy whitbyos_invoices_select_client on public.whitbyos_invoices
  for select
  using (public.portal_is_client_of(client_id) and sent_at is not null);

drop policy if exists whitbyos_invoice_lines_staff on public.whitbyos_invoice_lines;
create policy whitbyos_invoice_lines_staff on public.whitbyos_invoice_lines
  for all
  using (
    exists (
      select 1 from public.whitbyos_invoices i
      where i.id = invoice_id and public.is_workspace_member(i.workspace_id)
    )
  )
  with check (
    exists (
      select 1 from public.whitbyos_invoices i
      where i.id = invoice_id and public.is_workspace_member(i.workspace_id)
    )
  );

-- The same two conditions as the invoice itself. A line is part of the document
-- and must not outlive its parent's gate: reached through the invoice, so a
-- draft's lines are as unreachable as the draft.
drop policy if exists whitbyos_invoice_lines_select_client on public.whitbyos_invoice_lines;
create policy whitbyos_invoice_lines_select_client on public.whitbyos_invoice_lines
  for select
  using (
    exists (
      select 1 from public.whitbyos_invoices i
      where i.id = invoice_id
        and public.portal_is_client_of(i.client_id)
        and i.sent_at is not null
    )
  );

-- Staff only. The numbering function is SECURITY DEFINER and does not depend on
-- this, but the table is given a policy rather than being left with RLS on and
-- none — that combination denies every read with no error, and this folder's
-- README exists largely because of it.
drop policy if exists whitbyos_invoice_counters_staff on public.whitbyos_invoice_counters;
create policy whitbyos_invoice_counters_staff on public.whitbyos_invoice_counters
  for all
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

commit;
