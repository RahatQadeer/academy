-- No-op / cleanup: course tags reuse academy_programs.category (no new tables).
-- DROP TABLE IF EXISTS also removes policies and indexes; safe when tables were never created.

drop table if exists public.academy_program_tags cascade;
drop table if exists public.academy_course_tags cascade;
