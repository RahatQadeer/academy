-- 066 — `portal_can_see_billing()` learns the two areas that were added after it.
--
-- 061 moved the Billing permission into the invoice policies, and said in its
-- own header that the resolver "has to agree with `readAreas` in
-- `client-portal/lib/access.ts` exactly, because a policy that is stricter than
-- the screen hides rows the screen promises, and one that is looser is the hole
-- this file closes."
--
-- It stopped agreeing. `PORTAL_AREAS` grew `integrations` and `people` when
-- those two screens were brought inside the permission system, so the portal
-- now recognises nine area keys and 061's list names seven. That list is not
-- decoration: it is step 3, the test for "was anything ever decided about this
-- membership", and a key it does not recognise does not count as a decision.
--
-- So a membership whose permissions are exactly `{"integrations": true}` —
-- which `client-portal/migrations/approve_access_request.sql` produces from a
-- client who asked for Integrations and nothing else, since it builds the
-- object with `jsonb_object_agg` over whatever was requested — is read two
-- different ways:
--
--   `readAreas`   sees one written area key, so nothing is inherited, and
--                 `billing` is absent from a decided object, which is false.
--   061's version sees no key it recognises, concludes nothing was ever
--                 decided, and inherits everything — including Billing.
--
-- The application is the strict one, so the portal still refuses: the route
-- guard in `client-portal/routes.tsx` and the `areas.billing` check in
-- `readInvoices` both hold. But 061 exists precisely because those two are not
-- the only path to the row — the portal ships a browser Supabase client, so the
-- member's own token reaches PostgREST directly — and under this divergence
-- that path answers with the invoice again. The hole is narrower than the one
-- 061 closed, not different in kind.
--
-- The fix is the seven-item list becoming a nine-item one. Nothing else in the
-- function changes, and neither policy is touched: 061's policies call the
-- function by name, so replacing the function is the whole change.
--
-- WHY NOT EDIT 061
-- It is marked Applied in the README, so editing it changes nothing on any
-- environment that has already run it. `create or replace function` is how 061
-- itself is written, and re-running this file is harmless.
--
-- WHY THE LIST IS STILL HARDCODED
-- It is the third copy of the same nine keys — `PORTAL_AREAS`, `ACCESS_AREAS`
-- and this — and there is no way to share one list across TypeScript and a SQL
-- policy. All three now carry a comment naming the other two, which is the only
-- guard available: the next area added has to be added in three places, and
-- adding it in two is exactly the bug this file fixes.

begin;

create or replace function public.portal_can_see_billing(p_client_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  -- `bool_or`: a contact has one membership per client in practice, and the
  -- application reads it with `.maybeSingle()`. If two ever existed, being
  -- granted Billing on either is a grant, which is how OR-combined policies
  -- behave everywhere else in this schema.
  select coalesce(bool_or(
    case
      when m.role = 'primary_member' then true
      when m.permissions is null then true
      when jsonb_typeof(m.permissions) <> 'object' then true
      when not exists (
        select 1
        from jsonb_object_keys(m.permissions) as k
        where k in (
          -- Every key in `PORTAL_AREAS` (client-portal/lib/access.ts), which is
          -- also every key in `ACCESS_AREAS` (whitbyos/lib/access-requests-vocab.ts).
          -- `view_only` is deliberately absent from all three: it says how
          -- somebody may act, not what they may reach, so an object holding
          -- only that has still decided nothing.
          'requests', 'messages', 'calendar', 'documents',
          'forms', 'updates', 'billing',
          -- Added by 066. Neither grants Billing; both count as a decision
          -- having been made, which is what this test is asking.
          'integrations', 'people'
        )
      ) then true
      else coalesce(m.permissions ->> 'billing', '') = 'true'
    end
  ), false)
  from public.whitbyos_client_members m
  where m.client_id = p_client_id
    and m.contact_id = public.portal_contact_id()
    -- Someone with no way into the portal is not being granted anything here.
    -- `portal_client_ids()` makes the same check.
    and m.portal_access = true;
$$;

commit;

-- ---------------------------------------------------------------------------
-- Verification
--
-- The two rows that change behaviour are the ones carrying a new key and no
-- old one. As the member's own JWT, not the service role:
--
--   -- permissions = {"integrations": true}  → was: invoice visible
--   --                                          now: zero rows
--   select count(*) from whitbyos_invoices;
--
--   -- permissions = {"people": true}        → was: invoice visible
--   --                                          now: zero rows
--
-- And the rows that must not change:
--
--   -- permissions = {}                      → visible (nothing decided)
--   -- permissions = {"view_only": true}     → visible (not an area key)
--   -- permissions = {"billing": true, ...}  → visible
--   -- permissions = {"billing": false, ...} → zero rows
--   -- role = primary_member                 → visible
--   -- any draft (sent_at is null)           → zero rows, to everybody
--
-- The professional's `_staff` policy is untouched and sees both either way.
-- ---------------------------------------------------------------------------
