-- Staging draft for published programs: edits save here until Publish changes.
-- Learners keep reading live modules/lessons until the draft is applied.

alter table public.academy_programs
  add column if not exists unpublished_draft jsonb,
  add column if not exists unpublished_draft_updated_at timestamptz;

comment on column public.academy_programs.unpublished_draft is
  'Pending curriculum/metadata for a published program. Null = learners see live rows only.';

comment on column public.academy_programs.unpublished_draft_updated_at is
  'When unpublished_draft was last saved.';

create index if not exists academy_programs_unpublished_draft_updated_at_idx
  on public.academy_programs (unpublished_draft_updated_at desc nulls last)
  where unpublished_draft is not null;
