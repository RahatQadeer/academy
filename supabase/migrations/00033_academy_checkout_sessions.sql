-- Academy paid enrollment checkout sessions (Stripe-ready).
-- Checkout rows track payment state; enrollments are created only after payment succeeds.

create table if not exists public.academy_checkout_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  program_id uuid not null references public.academy_programs (id) on delete restrict,
  amount numeric not null check (amount >= 0),
  currency text not null default 'usd',
  status text not null default 'pending'
    check (status in ('pending', 'paid', 'expired', 'failed', 'canceled')),
  stripe_checkout_session_id text,
  stripe_payment_intent_id text,
  enrollment_id uuid references public.academy_enrollments (id) on delete set null,
  paid_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists academy_checkout_sessions_stripe_checkout_session_id_key
  on public.academy_checkout_sessions (stripe_checkout_session_id)
  where stripe_checkout_session_id is not null;

create unique index if not exists academy_checkout_sessions_pending_user_program_key
  on public.academy_checkout_sessions (user_id, program_id)
  where status = 'pending';

drop trigger if exists academy_checkout_sessions_set_updated_at on public.academy_checkout_sessions;
create trigger academy_checkout_sessions_set_updated_at
  before update on public.academy_checkout_sessions
  for each row execute function public.set_updated_at();

create or replace function public.academy_program_is_paid_published(p_program_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.academy_programs
    where id = p_program_id
      and status = 'published'
      and price is not null
      and price > 0
  );
$$;

-- Idempotent fulfillment for Stripe webhooks and mock checkout.
create or replace function public.academy_fulfill_checkout(p_checkout_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_checkout public.academy_checkout_sessions%rowtype;
  v_program public.academy_programs%rowtype;
  v_enrollment_id uuid;
begin
  select *
  into v_checkout
  from public.academy_checkout_sessions
  where id = p_checkout_id
  for update;

  if not found then
    raise exception 'checkout_not_found';
  end if;

  if v_checkout.status = 'paid' and v_checkout.enrollment_id is not null then
    return v_checkout.enrollment_id;
  end if;

  if v_checkout.status <> 'pending' then
    raise exception 'checkout_not_pending';
  end if;

  if v_checkout.expires_at is not null and v_checkout.expires_at < now() then
    update public.academy_checkout_sessions
    set status = 'expired', updated_at = now()
    where id = p_checkout_id;
    raise exception 'checkout_expired';
  end if;

  select *
  into v_program
  from public.academy_programs
  where id = v_checkout.program_id;

  if not found or v_program.status <> 'published' or v_program.price is null or v_program.price <= 0 then
    raise exception 'program_unavailable';
  end if;

  if v_program.price <> v_checkout.amount then
    raise exception 'amount_mismatch';
  end if;

  select id
  into v_enrollment_id
  from public.academy_enrollments
  where user_id = v_checkout.user_id
    and program_id = v_checkout.program_id;

  if v_enrollment_id is null then
    insert into public.academy_enrollments (
      user_id,
      program_id,
      status,
      progress_percent,
      entitlement_source,
      completed_at
    )
    values (
      v_checkout.user_id,
      v_checkout.program_id,
      'enrolled',
      0,
      'purchase',
      null
    )
    returning id into v_enrollment_id;
  end if;

  update public.academy_checkout_sessions
  set
    status = 'paid',
    paid_at = coalesce(paid_at, now()),
    enrollment_id = v_enrollment_id,
    updated_at = now()
  where id = p_checkout_id;

  return v_enrollment_id;
end;
$$;

alter table public.academy_checkout_sessions enable row level security;

drop policy if exists academy_checkout_sessions_select on public.academy_checkout_sessions;
drop policy if exists academy_checkout_sessions_select_learner on public.academy_checkout_sessions;
drop policy if exists academy_checkout_sessions_select_admin on public.academy_checkout_sessions;
drop policy if exists academy_checkout_sessions_insert on public.academy_checkout_sessions;
drop policy if exists academy_checkout_sessions_insert_learner on public.academy_checkout_sessions;
drop policy if exists academy_checkout_sessions_update on public.academy_checkout_sessions;
drop policy if exists academy_checkout_sessions_update_admin on public.academy_checkout_sessions;

create policy academy_checkout_sessions_select_learner on public.academy_checkout_sessions
  for select using (
    public.has_academy_entitlement()
    and public.has_academy_role('learner')
    and user_id = auth.uid()
  );

create policy academy_checkout_sessions_select_admin on public.academy_checkout_sessions
  for select using (
    public.has_academy_entitlement()
    and public.is_academy_admin()
  );

create policy academy_checkout_sessions_insert_learner on public.academy_checkout_sessions
  for insert with check (
    public.has_academy_entitlement()
    and public.has_academy_role('learner')
    and user_id = auth.uid()
    and status = 'pending'
    and enrollment_id is null
    and paid_at is null
    and public.academy_program_is_paid_published(program_id)
    and public.academy_self_prerequisite_satisfied(program_id)
  );

create policy academy_checkout_sessions_update_admin on public.academy_checkout_sessions
  for update using (
    public.has_academy_entitlement()
    and public.is_academy_admin()
  )
  with check (
    public.has_academy_entitlement()
    and public.is_academy_admin()
  );

grant execute on function public.academy_program_is_paid_published(uuid) to anon, authenticated, service_role;
grant execute on function public.academy_fulfill_checkout(uuid) to service_role;
