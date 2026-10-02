-- Whitby schema — owner: Sabahat (prefix whitbyos_)

create table public.whitbyos_clients (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name text not null,
  client_type public.whitbyos_client_type not null,
  status text not null default 'active',
  owner_user_id uuid not null references public.users (id),
  primary_contact_id uuid references public.contacts (id),
  preferences jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.whitbyos_client_members (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.whitbyos_clients (id) on delete cascade,
  contact_id uuid not null references public.contacts (id),
  role public.contact_role_label not null,
  portal_access boolean not null default false,
  max_additional_members integer,
  max_authorized_users integer,
  created_at timestamptz not null default now()
);

create table public.whitbyos_requests (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.whitbyos_clients (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  title text not null,
  desired_outcome text,
  definition_of_done text,
  status text not null default 'open',
  priority text,
  owner_user_id uuid references public.users (id),
  start_date date,
  target_date date,
  waiting_on text,
  next_action text,
  visibility public.whitbyos_request_visibility not null default 'client_account',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  closed_at timestamptz
);

create table public.whitbyos_request_participants (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.whitbyos_requests (id) on delete cascade,
  participant_type text not null,
  participant_id uuid not null,
  role text,
  created_at timestamptz not null default now()
);

create table public.whitbyos_workplans (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique references public.whitbyos_requests (id) on delete cascade,
  name text not null,
  desired_outcome text,
  definition_of_done text,
  owner_user_id uuid references public.users (id),
  status public.whitbyos_workplan_status not null default 'draft',
  start_date date,
  target_date date,
  current_next_action text,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.whitbyos_workplan_versions (
  id uuid primary key default gen_random_uuid(),
  workplan_id uuid not null references public.whitbyos_workplans (id) on delete cascade,
  version_number integer not null,
  snapshot jsonb not null,
  change_reason text,
  created_by_user_id uuid references public.users (id),
  created_at timestamptz not null default now()
);

create table public.whitbyos_workstreams (
  id uuid primary key default gen_random_uuid(),
  workplan_id uuid not null references public.whitbyos_workplans (id) on delete cascade,
  name text not null,
  purpose text,
  priority integer,
  owner_user_id uuid references public.users (id),
  status public.whitbyos_workstream_status not null default 'not_started',
  target_date date,
  next_action text,
  progress text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.whitbyos_tasks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  request_id uuid references public.whitbyos_requests (id) on delete set null,
  workstream_id uuid references public.whitbyos_workstreams (id) on delete set null,
  title text not null,
  owner_user_id uuid references public.users (id),
  status text not null default 'open',
  priority text,
  due_date timestamptz,
  waiting_state text,
  dependency_task_id uuid references public.whitbyos_tasks (id),
  next_action text,
  completion_evidence text,
  visibility public.visibility_level not null default 'internal',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.whitbyos_workstream_dependencies (
  id uuid primary key default gen_random_uuid(),
  workstream_id uuid not null references public.whitbyos_workstreams (id) on delete cascade,
  depends_on_workstream_id uuid references public.whitbyos_workstreams (id),
  depends_on_task_id uuid references public.whitbyos_tasks (id),
  description text
);

create table public.whitbyos_worksheets (
  id uuid primary key default gen_random_uuid(),
  workstream_id uuid not null references public.whitbyos_workstreams (id) on delete cascade,
  title text not null,
  type text,
  data jsonb,
  created_from text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.whitbyos_worksheet_rows (
  id uuid primary key default gen_random_uuid(),
  worksheet_id uuid not null references public.whitbyos_worksheets (id) on delete cascade,
  row_data jsonb,
  linked_task_id uuid references public.whitbyos_tasks (id),
  linked_provider_id uuid,
  linked_decision_id uuid,
  created_at timestamptz not null default now()
);

create table public.whitbyos_forms (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  title text not null,
  is_template boolean not null default false,
  fields jsonb,
  embed_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.whitbyos_form_submissions (
  id uuid primary key default gen_random_uuid(),
  form_id uuid not null references public.whitbyos_forms (id) on delete cascade,
  request_id uuid references public.whitbyos_requests (id),
  client_id uuid references public.whitbyos_clients (id),
  submitted_by_contact_id uuid references public.contacts (id),
  status text not null default 'submitted',
  responses jsonb,
  submitted_at timestamptz
);

create table public.whitbyos_checklists (
  id uuid primary key default gen_random_uuid(),
  workstream_id uuid not null references public.whitbyos_workstreams (id) on delete cascade,
  title text not null,
  items jsonb,
  source_playbook_id uuid,
  created_at timestamptz not null default now()
);

create table public.whitbyos_playbooks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name text not null,
  category text,
  contents jsonb,
  version integer not null default 1,
  shared_level text not null default 'my',
  created_from_workplan_id uuid references public.whitbyos_workplans (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.whitbyos_providers (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid references public.contacts (id),
  company_id uuid references public.companies (id),
  readiness public.whitbyos_provider_readiness not null default 'prospect',
  category_id text references public.taxonomy_categories (id),
  subcategory_id text references public.taxonomy_subcategories (id),
  specialty_capability text,
  evidence_source text,
  last_verified_at timestamptz,
  outreach_status text,
  next_follow_up_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.whitbyos_provider_options (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.whitbyos_requests (id) on delete cascade,
  provider_id uuid not null references public.whitbyos_providers (id),
  status public.whitbyos_provider_option_status not null default 'option_for_review',
  client_visible_content jsonb,
  created_at timestamptz not null default now()
);

create table public.whitbyos_messages (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  thread_id uuid not null,
  request_id uuid references public.whitbyos_requests (id),
  client_id uuid references public.whitbyos_clients (id),
  sender_type text not null,
  sender_id uuid not null,
  body text not null,
  source text,
  external_message_id text,
  created_at timestamptz not null default now()
);

create table public.whitbyos_message_participants (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null,
  participant_type text not null,
  participant_id uuid not null,
  history_visibility text not null default 'full',
  added_by_user_id uuid references public.users (id),
  added_at timestamptz not null default now(),
  removed_at timestamptz,
  locked boolean not null default false
);

create table public.whitbyos_communications (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  request_id uuid references public.whitbyos_requests (id),
  client_id uuid references public.whitbyos_clients (id),
  type text not null,
  summary text,
  logged_by_user_id uuid references public.users (id),
  occurred_at timestamptz not null default now()
);

create table public.whitbyos_calendar_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  external_calendar text,
  external_event_id text,
  title text not null,
  start_at timestamptz,
  end_at timestamptz,
  linked_client_id uuid references public.whitbyos_clients (id),
  linked_request_id uuid references public.whitbyos_requests (id),
  linked_contact_id uuid references public.contacts (id),
  client_visible boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.whitbyos_notes (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.whitbyos_requests (id) on delete cascade,
  type text not null default 'general',
  body text not null,
  visibility public.visibility_level not null default 'internal',
  created_by_user_id uuid references public.users (id),
  created_at timestamptz not null default now()
);

create table public.whitbyos_considerations (
  id uuid primary key default gen_random_uuid(),
  workplan_id uuid not null references public.whitbyos_workplans (id) on delete cascade,
  workstream_id uuid references public.whitbyos_workstreams (id),
  type public.whitbyos_consideration_type not null,
  body text not null,
  source_reference text,
  status public.whitbyos_consideration_status not null default 'open',
  converted_to_task_id uuid references public.whitbyos_tasks (id),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create table public.whitbyos_decisions (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.whitbyos_requests (id) on delete cascade,
  workstream_id uuid references public.whitbyos_workstreams (id),
  title text not null,
  options jsonb,
  recommendation text,
  decision_maker_contact_id uuid references public.contacts (id),
  approver_contact_id uuid references public.contacts (id),
  due_date date,
  amount_threshold numeric,
  status text not null default 'open',
  result text,
  created_at timestamptz not null default now()
);

create table public.whitbyos_risks (
  id uuid primary key default gen_random_uuid(),
  workstream_id uuid not null references public.whitbyos_workstreams (id) on delete cascade,
  risk text not null,
  impact text,
  mitigation text,
  backup_plan text,
  trigger text,
  status text not null default 'open',
  created_at timestamptz not null default now()
);

create table public.whitbyos_updates (
  id uuid primary key default gen_random_uuid(),
  request_id uuid references public.whitbyos_requests (id),
  client_id uuid not null references public.whitbyos_clients (id),
  type public.whitbyos_update_type not null,
  body text not null,
  status public.whitbyos_update_status not null default 'draft',
  published_at timestamptz,
  created_by_user_id uuid references public.users (id),
  created_at timestamptz not null default now()
);

create table public.whitbyos_timeline_events (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.whitbyos_requests (id) on delete cascade,
  event_type text not null,
  description text not null,
  source_reference text,
  client_visible boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.whitbyos_knowledge (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  title text not null,
  type text not null,
  body_or_file_url text,
  category text,
  status text not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.whitbyos_integrations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  provider public.whitbyos_integration_provider not null,
  status public.whitbyos_integration_status not null default 'available',
  connected_account text,
  scopes text,
  last_sync_at timestamptz,
  error_state text,
  created_at timestamptz not null default now()
);

create table public.whitbyos_insight_saves (
  id uuid primary key default gen_random_uuid(),
  consideration_id uuid not null references public.whitbyos_considerations (id) on delete cascade,
  saved_by_user_id uuid not null references public.users (id),
  created_at timestamptz not null default now()
);

create or replace function public.whitbyos_workspace_guard(p_workspace_id uuid)
returns boolean
language sql
stable
as $$
  select public.is_workspace_member(p_workspace_id);
$$;

alter table public.whitbyos_clients enable row level security;
alter table public.whitbyos_client_members enable row level security;
alter table public.whitbyos_requests enable row level security;
alter table public.whitbyos_request_participants enable row level security;
alter table public.whitbyos_workplans enable row level security;
alter table public.whitbyos_workplan_versions enable row level security;
alter table public.whitbyos_workstreams enable row level security;
alter table public.whitbyos_workstream_dependencies enable row level security;
alter table public.whitbyos_tasks enable row level security;
alter table public.whitbyos_worksheets enable row level security;
alter table public.whitbyos_worksheet_rows enable row level security;
alter table public.whitbyos_forms enable row level security;
alter table public.whitbyos_form_submissions enable row level security;
alter table public.whitbyos_checklists enable row level security;
alter table public.whitbyos_playbooks enable row level security;
alter table public.whitbyos_providers enable row level security;
alter table public.whitbyos_provider_options enable row level security;
alter table public.whitbyos_messages enable row level security;
alter table public.whitbyos_message_participants enable row level security;
alter table public.whitbyos_communications enable row level security;
alter table public.whitbyos_calendar_events enable row level security;
alter table public.whitbyos_notes enable row level security;
alter table public.whitbyos_considerations enable row level security;
alter table public.whitbyos_decisions enable row level security;
alter table public.whitbyos_risks enable row level security;
alter table public.whitbyos_updates enable row level security;
alter table public.whitbyos_timeline_events enable row level security;
alter table public.whitbyos_knowledge enable row level security;
alter table public.whitbyos_integrations enable row level security;
alter table public.whitbyos_insight_saves enable row level security;

create policy whitbyos_clients_all on public.whitbyos_clients
  for all using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

create policy whitbyos_requests_all on public.whitbyos_requests
  for all using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

create policy whitbyos_tasks_all on public.whitbyos_tasks
  for all using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

create policy whitbyos_forms_all on public.whitbyos_forms
  for all using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

create policy whitbyos_playbooks_all on public.whitbyos_playbooks
  for all using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

create policy whitbyos_messages_all on public.whitbyos_messages
  for all using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

create policy whitbyos_communications_all on public.whitbyos_communications
  for all using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

create policy whitbyos_calendar_all on public.whitbyos_calendar_events
  for all using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

create policy whitbyos_knowledge_all on public.whitbyos_knowledge
  for all using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

create policy whitbyos_integrations_all on public.whitbyos_integrations
  for all using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

-- Nested records: workspace members who can see the parent client/request.
create policy whitbyos_client_members_all on public.whitbyos_client_members
  for all using (
    exists (
      select 1 from public.whitbyos_clients c
      where c.id = client_id and public.is_workspace_member(c.workspace_id)
    )
  );

create policy whitbyos_request_participants_all on public.whitbyos_request_participants
  for all using (
    exists (
      select 1 from public.whitbyos_requests r
      where r.id = request_id and public.is_workspace_member(r.workspace_id)
    )
  );

create policy whitbyos_workplans_all on public.whitbyos_workplans
  for all using (
    exists (
      select 1 from public.whitbyos_requests r
      where r.id = request_id and public.is_workspace_member(r.workspace_id)
    )
  );

create policy whitbyos_providers_select on public.whitbyos_providers
  for all using (auth.uid() is not null)
  with check (auth.uid() is not null);
