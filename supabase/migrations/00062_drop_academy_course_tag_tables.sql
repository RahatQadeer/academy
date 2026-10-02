-- Idempotent cleanup if an earlier draft of 00061 created tag tables.
-- Safe when tables do not exist (unlike DROP POLICY … ON missing_table).

drop table if exists public.academy_program_tags cascade;
drop table if exists public.academy_course_tags cascade;
