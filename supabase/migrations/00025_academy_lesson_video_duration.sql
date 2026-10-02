-- Optional video duration for Academy lesson authoring (used by catalog generation).

alter table public.academy_lessons
  add column if not exists video_duration_seconds integer;
