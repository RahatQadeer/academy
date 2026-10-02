-- Program cover image for catalog overview and learner explore views.

alter table public.academy_programs
  add column if not exists cover_image_url text;
