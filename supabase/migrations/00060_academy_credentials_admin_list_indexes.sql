-- Speed up admin Certificates & Credentials list views (status-scoped reads).

create index if not exists academy_credentials_status_awarded_at_idx
  on public.academy_credentials (status, awarded_at desc nulls last);

create index if not exists academy_credentials_status_expires_at_idx
  on public.academy_credentials (status, expires_at)
  where expires_at is not null and status = 'awarded';

create index if not exists academy_credentials_status_type_idx
  on public.academy_credentials (status, type);

create index if not exists academy_applied_work_submissions_open_status_idx
  on public.academy_applied_work_submissions (status, credential_id)
  where status in ('submitted', 'under_review');
