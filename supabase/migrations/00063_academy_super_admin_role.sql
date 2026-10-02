-- Academy Super Admin role enum only (membership-based; no new tables).
-- Postgres requires the new enum value to be COMMITTED before any use
-- (functions, casts, inserts). Helpers live in 00063b_*.sql.

alter type public.academy_role add value if not exists 'super_admin';
