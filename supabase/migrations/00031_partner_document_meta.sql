-- Partner Center — document metadata side table (does not alter public.documents)
-- File/title/status/visibility/version stay on documents.
-- Partner-only: program, expiration, signature ref, type, needed action.
-- Idempotent: safe if already applied in Supabase SQL editor.

do $$ begin
  create type public.partner_document_needed_action as enum (
    'review',
    'sign_externally',
    'upload',
    'update'
  );
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type public.partner_document_kind as enum (
    'agreement',
    'program_terms',
    'guideline',
    'marketing',
    'tax',
    'other'
  );
exception
  when duplicate_object then null;
end $$;

-- Add tax kind if table was created from an earlier draft without it.
do $$ begin
  alter type public.partner_document_kind add value if not exists 'tax';
exception
  when others then null;
end $$;

create table if not exists public.partner_document_meta (
  document_id uuid primary key references public.documents (id) on delete cascade,
  partner_profile_id uuid not null references public.partner_profiles (id) on delete cascade,
  program public.partner_program_family,
  expiration_date date,
  external_signature_ref text,
  document_kind public.partner_document_kind not null default 'other',
  needed_action public.partner_document_needed_action,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists partner_document_meta_profile_idx
  on public.partner_document_meta (partner_profile_id);

create index if not exists partner_document_meta_program_idx
  on public.partner_document_meta (partner_profile_id, program);

drop trigger if exists partner_document_meta_set_updated_at on public.partner_document_meta;
create trigger partner_document_meta_set_updated_at
  before update on public.partner_document_meta
  for each row execute function public.set_updated_at();

alter table public.partner_document_meta enable row level security;

drop policy if exists partner_document_meta_member on public.partner_document_meta;
create policy partner_document_meta_member on public.partner_document_meta
  for all
  using (public.is_partner_member(partner_profile_id))
  with check (public.is_partner_member(partner_profile_id));
