-- =====================================================================
-- Create (or reset the password of) a Super Admin staff login.
--
-- Super Admin is NOT a product account. There is no Supabase Auth user, no
-- workspace and no entitlement behind it — just a row in `public.super_admins`
-- holding an email and a bcrypt hash, checked at /super-admin/signin and
-- carried afterwards in an HMAC cookie.
--
-- Run this in the Supabase SQL Editor. `upsert_super_admin` is execute-granted
-- to `service_role` and `postgres` only, and the editor connects as an owner
-- role, so it works there and from nowhere a browser can reach.
--
-- BEFORE THIS WORKS:
--   1. Migrations 00044 and 00045 are applied.
--   2. SUPER_ADMIN_SESSION_SECRET is set in the environment (min 32 chars).
--      Without it /api/super-admin/login refuses to issue a cookie, and a
--      correct password still cannot sign in.
--
-- Re-running with the same email resets that password rather than erroring —
-- which is also how you recover a lost one.
-- =====================================================================

-- ---------------------------------------------------------------------
-- EDIT THESE TWO LINES, then run the whole file.
-- The password must be at least 12 characters (00045 raised it from 8).
-- ---------------------------------------------------------------------
select public.upsert_super_admin(
  'you@example.com',
  'change-this-to-a-long-password'
);


-- ---------------------------------------------------------------------
-- Confirm it took. The hash is never shown — a bcrypt digest is still a
-- credential, and this file may be pasted into a terminal that keeps history.
-- ---------------------------------------------------------------------
select email, created_at, updated_at
  from public.super_admins
 order by updated_at desc;


-- ---------------------------------------------------------------------
-- Prove the password verifies, without signing in through the browser.
-- Returns true when the pair is good. Use the same two values as above.
-- ---------------------------------------------------------------------
-- select public.verify_super_admin(
--   'you@example.com',
--   'change-this-to-a-long-password'
-- ) as password_ok;


-- ---------------------------------------------------------------------
-- Locked out? Sign-in blocks an IP+email key after 5 failures in 15 minutes
-- (00045). This clears the counter for one address.
-- ---------------------------------------------------------------------
-- delete from public.super_admin_login_attempts
--  where attempt_key like '%' || lower(btrim('you@example.com'));


-- ---------------------------------------------------------------------
-- Remove a staff login. Deleting the row is the whole revocation — but an
-- already-issued cookie stays valid until it expires (2h), because it is
-- verified by HMAC rather than by a lookup. Rotate
-- SUPER_ADMIN_SESSION_SECRET to cut every live session immediately.
-- ---------------------------------------------------------------------
-- delete from public.super_admins where email = 'them@example.com';
