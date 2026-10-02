-- RLS helpers and base policies. Service role bypasses RLS by default.

create or replace function public.current_user_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid();
$$;

create or replace function public.is_workspace_member(p_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.workspace_members
    where workspace_id = p_workspace_id
      and user_id = auth.uid()
      and status = 'active'
  );
$$;

create or replace function public.has_entitlement(p_product public.product_key)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.entitlements
    where user_id = auth.uid()
      and product = p_product
      and status in ('active', 'trial')
  );
$$;

create or replace function public.shares_workspace_with(p_other_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.workspace_members a
    join public.workspace_members b on a.workspace_id = b.workspace_id
    where a.user_id = auth.uid()
      and b.user_id = p_other_user_id
      and a.status = 'active'
      and b.status = 'active'
  );
$$;

alter table public.users enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.entitlements enable row level security;
alter table public.invitations enable row level security;
alter table public.contacts enable row level security;
alter table public.contact_roles enable row level security;
alter table public.companies enable row level security;
alter table public.company_contacts enable row level security;
alter table public.documents enable row level security;
alter table public.document_labels enable row level security;
alter table public.audit_log enable row level security;
alter table public.taxonomy_categories enable row level security;
alter table public.taxonomy_subcategories enable row level security;

create policy users_select_self on public.users
  for select using (id = auth.uid());

create policy users_update_self on public.users
  for update using (id = auth.uid());

create policy users_select_teammates on public.users
  for select using (public.shares_workspace_with(id));

create policy workspaces_select_member on public.workspaces
  for select using (public.is_workspace_member(id) or owner_user_id = auth.uid());

create policy workspaces_insert_owner on public.workspaces
  for insert with check (owner_user_id = auth.uid());

create policy workspaces_update_member on public.workspaces
  for update using (public.is_workspace_member(id));

create policy workspace_members_select on public.workspace_members
  for select using (
    user_id = auth.uid() or public.is_workspace_member(workspace_id)
  );

create policy workspace_members_insert on public.workspace_members
  for insert with check (
    user_id = auth.uid() or public.is_workspace_member(workspace_id)
  );

create policy workspace_members_update on public.workspace_members
  for update using (public.is_workspace_member(workspace_id));

create policy entitlements_select_own on public.entitlements
  for select using (user_id = auth.uid());

create policy entitlements_insert_own on public.entitlements
  for insert with check (user_id = auth.uid());

create policy invitations_select on public.invitations
  for select using (
    inviter_user_id = auth.uid()
    or created_by = auth.uid()
    or invitee_email = (select email from public.users where id = auth.uid())
  );

create policy invitations_insert on public.invitations
  for insert with check (created_by = auth.uid());

create policy invitations_update on public.invitations
  for update using (
    created_by = auth.uid()
    or invitee_email = (select email from public.users where id = auth.uid())
  );

create policy contacts_select on public.contacts
  for select using (
    created_by_workspace_id is null
    or public.is_workspace_member(created_by_workspace_id)
  );

create policy contacts_write on public.contacts
  for all using (
    created_by_workspace_id is null
    or public.is_workspace_member(created_by_workspace_id)
  )
  with check (
    created_by_workspace_id is null
    or public.is_workspace_member(created_by_workspace_id)
  );

create policy contact_roles_select on public.contact_roles
  for select using (
    workspace_id is null or public.is_workspace_member(workspace_id)
  );

create policy contact_roles_write on public.contact_roles
  for all using (
    workspace_id is null or public.is_workspace_member(workspace_id)
  )
  with check (
    workspace_id is null or public.is_workspace_member(workspace_id)
  );

create policy companies_select on public.companies
  for select using (
    created_by_workspace_id is null
    or public.is_workspace_member(created_by_workspace_id)
  );

create policy companies_write on public.companies
  for all using (
    created_by_workspace_id is null
    or public.is_workspace_member(created_by_workspace_id)
  )
  with check (
    created_by_workspace_id is null
    or public.is_workspace_member(created_by_workspace_id)
  );

create policy company_contacts_all on public.company_contacts
  for all using (auth.uid() is not null)
  with check (auth.uid() is not null);

create policy documents_select on public.documents
  for select using (
    uploaded_by_user_id = auth.uid()
    or shared_by_user_id = auth.uid()
    or (
      visibility = 'client_visible'
      and public.has_entitlement('client_portal')
    )
    or (
      visibility <> 'restricted'
      and public.shares_workspace_with(uploaded_by_user_id)
    )
  );

create policy documents_write on public.documents
  for all using (
    uploaded_by_user_id = auth.uid()
    or public.shares_workspace_with(uploaded_by_user_id)
  )
  with check (uploaded_by_user_id = auth.uid() or auth.uid() is not null);

create policy document_labels_all on public.document_labels
  for all using (created_by_user_id = auth.uid() or auth.uid() is not null)
  with check (created_by_user_id = auth.uid());

create policy audit_log_select on public.audit_log
  for select using (actor_user_id = auth.uid() or public.shares_workspace_with(actor_user_id));

create policy audit_log_insert on public.audit_log
  for insert with check (actor_user_id = auth.uid());

create policy taxonomy_read on public.taxonomy_categories
  for select using (true);

create policy taxonomy_sub_read on public.taxonomy_subcategories
  for select using (true);
