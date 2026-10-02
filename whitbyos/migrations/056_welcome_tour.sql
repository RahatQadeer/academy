-- 056 — remembering that somebody has seen the welcome tour.
--
-- Screens 1.4 to 1.9 are shown automatically on a professional's first login,
-- and 1.9 says the tour can be started again from Settings, Workspace. Both
-- need somewhere to record that it has been seen; nothing held that.
--
-- On users rather than per workspace: the tour teaches the product, not a
-- workspace, so seeing it once and then switching workspace should not start
-- it over.

alter table public.users
  add column if not exists tour_seen_at timestamptz;
