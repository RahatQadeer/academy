-- Base canonical schema. No module may duplicate these tables.

create table public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null unique,
  password_hash text,
  oauth_provider text,
  oauth_id text,
  full_name text not null default '',
  preferred_name text,
  salutation text,
  phone text,
  avatar_url text,
  timezone text not null default 'UTC',
  status public.user_status not null default 'active',
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  url_slug text not null unique,
  logo_url text,
  team_size text,
  timezone text,
  owner_user_id uuid not null references public.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.workspace_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  role public.workspace_member_role not null default 'viewer',
  status public.workspace_member_status not null default 'invited',
  created_at timestamptz not null default now(),
  unique (workspace_id, user_id)
);

create table public.entitlements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  product public.product_key not null,
  workspace_id uuid references public.workspaces (id) on delete cascade,
  status public.entitlement_status not null default 'active',
  is_default_landing boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index entitlements_user_product_workspace_uidx
  on public.entitlements (
    user_id,
    product,
    coalesce(workspace_id, '00000000-0000-0000-0000-000000000000')
  );

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  token text not null unique,
  inviter_user_id uuid not null references public.users (id),
  invitee_email text not null,
  invitee_name text,
  context_type public.invitation_context_type not null,
  context_id uuid not null,
  role_or_relationship text not null default '',
  status public.invitation_status not null default 'pending',
  sent_at timestamptz,
  accepted_at timestamptz,
  expires_at timestamptz,
  created_by uuid not null references public.users (id),
  created_at timestamptz not null default now()
);

create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  first_name text not null,
  last_name text not null,
  preferred_name text,
  salutation text,
  email text,
  phone text,
  title_role text,
  source text,
  enrichment_data jsonb,
  created_by_workspace_id uuid references public.workspaces (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.contact_roles (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.contacts (id) on delete cascade,
  related_type public.contact_related_type not null,
  related_id uuid not null,
  role_label public.contact_role_label not null,
  workspace_id uuid references public.workspaces (id),
  portal_access boolean not null default false,
  scope jsonb,
  created_at timestamptz not null default now()
);

create table public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  website text,
  industry_type text,
  addresses jsonb,
  markets jsonb,
  audience_served text,
  enrichment_data jsonb,
  created_by_workspace_id uuid references public.workspaces (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.company_contacts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  contact_id uuid not null references public.contacts (id) on delete cascade,
  title_function text,
  is_primary boolean not null default false,
  unique (company_id, contact_id)
);

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  file_url text not null,
  context_type public.document_context_type not null,
  context_id uuid not null,
  visibility public.visibility_level not null default 'internal',
  status public.document_status not null default 'current',
  version integer not null default 1,
  effective_date date,
  signed_date date,
  superseded_by_document_id uuid references public.documents (id),
  uploaded_by_user_id uuid references public.users (id),
  shared_by_user_id uuid references public.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.document_labels (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents (id) on delete cascade,
  label_text text not null,
  created_by_user_id uuid not null references public.users (id)
);

create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid not null references public.users (id),
  entity_type text not null,
  entity_id uuid not null,
  action text not null,
  previous_value jsonb,
  new_value jsonb,
  reason text,
  created_at timestamptz not null default now()
);

create table public.taxonomy_categories (
  id text primary key,
  slug text not null unique,
  name text not null,
  sort_order integer not null default 0,
  active boolean not null default true,
  default_sensitivity public.taxonomy_sensitivity not null default 'normal'
);

create table public.taxonomy_subcategories (
  id text primary key,
  parent_category_id text not null references public.taxonomy_categories (id),
  slug text not null,
  name text not null,
  sort_order integer not null default 0,
  active boolean not null default true,
  default_sensitivity public.taxonomy_sensitivity not null default 'normal',
  unique (parent_category_id, slug)
);

create trigger users_set_updated_at
  before update on public.users
  for each row execute function public.set_updated_at();

create trigger workspaces_set_updated_at
  before update on public.workspaces
  for each row execute function public.set_updated_at();

create trigger entitlements_set_updated_at
  before update on public.entitlements
  for each row execute function public.set_updated_at();

create trigger contacts_set_updated_at
  before update on public.contacts
  for each row execute function public.set_updated_at();

create trigger companies_set_updated_at
  before update on public.companies
  for each row execute function public.set_updated_at();

create trigger documents_set_updated_at
  before update on public.documents
  for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (
    id,
    email,
    oauth_provider,
    oauth_id,
    full_name,
    avatar_url,
    timezone
  )
  values (
    new.id,
    coalesce(new.email, ''),
    new.raw_app_meta_data->>'provider',
    new.raw_user_meta_data->>'provider_id',
    coalesce(new.raw_user_meta_data->>'full_name', split_part(coalesce(new.email, 'account'), '@', 1)),
    new.raw_user_meta_data->>'avatar_url',
    coalesce(new.raw_user_meta_data->>'timezone', 'UTC')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
