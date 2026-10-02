-- 061 — the Billing permission, enforced by the database as well as the app.
--
-- 059's `_client` policy scopes an invoice to the reader's own account and to
-- invoices that have been sent. It does not look at the per-member Billing
-- permission, because that permission lives in a jsonb column the application
-- interprets. So a member of the account who has NOT been granted Billing was
-- refused by the portal — the route guard in `client-portal/routes.tsx` and the
-- check in `readInvoices` both hold — but the row itself was still readable.
--
-- That gap is reachable, not theoretical: the portal ships a browser Supabase
-- client (`client-portal/messages/components/LiveMessages.tsx`), so a member's
-- own session token exists in the browser, and PostgREST answers it directly.
-- Verified before writing this: selecting `whitbyos_invoices` as such a
-- member's JWT returned the invoice.
--
-- So the permission moves into the policy, and the application keeps its two
-- checks. Neither is now the only thing standing between a member and an
-- invoice.
--
-- ONLY the two invoice SELECT policies change. Every other `_client` and
-- `_staff` policy in the schema is untouched, and the staff policy on these
-- same tables is untouched, so the professional's screens are unaffected.
--
-- Re-runnable: `create or replace` for the function, and each policy dropped by
-- name before being created. One transaction.

begin;

-- ---------------------------------------------------------------------------
-- The resolver
--
-- It has to agree with `readAreas` in `client-portal/lib/access.ts` exactly,
-- because a policy that is stricter than the screen hides rows the screen
-- promises, and one that is looser is the hole this file closes. That function
-- decides Billing in four steps, and so does this:
--
--   1. A primary member holds the account. 2.1.2.1 never sets permissions for
--      them, so their row is empty and always will be; reading that emptiness
--      as "no access" would lock the account holder out of their own billing.
--
--   2. Anything that is not a json object is read as an empty one.
--
--   3. An object carrying no AREA key at all means nothing was ever decided,
--      which inherits everything. A membership made before 025, or by any path
--      other than the approval screen, is in exactly this state and has been
--      working with full access since the day it was made. Note that
--      `view_only` is not an area key, so `{"view_only": true}` still inherits
--      — the same as the TypeScript, which filters keys against AREA_KEYS
--      before counting them.
--
--   4. Otherwise the tick decides. `billing` absent from an object that does
--      carry other areas is false, not inherited: `DERIVED_FROM` covers
--      calendar, forms and updates only, and never billing.
--
-- SECURITY DEFINER and STABLE like every other `portal_*` resolver, so it reads
-- past RLS instead of recursing into the policy that calls it, and is evaluated
-- once per statement rather than once per row.
-- ---------------------------------------------------------------------------

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
          'requests', 'messages', 'calendar', 'documents',
          'forms', 'updates', 'billing'
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

-- ---------------------------------------------------------------------------
-- The two policies
--
-- The account check stays alongside the new one. `portal_can_see_billing`
-- already establishes membership, so it is redundant — deliberately: the two
-- conditions answer different questions, and a later edit to one should not
-- silently widen the other.
-- ---------------------------------------------------------------------------

drop policy if exists whitbyos_invoices_select_client on public.whitbyos_invoices;
create policy whitbyos_invoices_select_client on public.whitbyos_invoices
  for select
  using (
    public.portal_is_client_of(client_id)
    and sent_at is not null
    and public.portal_can_see_billing(client_id)
  );

-- A line carries the amounts, so it is gated on exactly what its invoice is
-- gated on. Reached through the invoice, so a line can never outlive its
-- parent's conditions.
drop policy if exists whitbyos_invoice_lines_select_client on public.whitbyos_invoice_lines;
create policy whitbyos_invoice_lines_select_client on public.whitbyos_invoice_lines
  for select
  using (
    exists (
      select 1 from public.whitbyos_invoices i
      where i.id = invoice_id
        and public.portal_is_client_of(i.client_id)
        and i.sent_at is not null
        and public.portal_can_see_billing(i.client_id)
    )
  );

commit;
