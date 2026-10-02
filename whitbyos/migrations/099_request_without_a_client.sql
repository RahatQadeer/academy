-- Work that belongs to the firm rather than to a client.
--
-- A Work Plan hangs off a Request and a Request belonged to a client, always
-- — which made every plan somebody's, and there was nowhere to put the firm's
-- own work, or a plan drawn before the client it is for has accepted their
-- invitation. The client asked for "None", and for it to mean none: no client
-- named on the plan, and nothing about it reaching a client's portal.
--
-- Null is what "none" is. The portal reads a client's work with
-- `client_id = <that client>` (client-portal/lib/data/requests.ts), so a
-- Request with no client matches no client and is invisible there by the same
-- rule that already governs everything else.
--
-- The read side needs nothing: `whitbyos/lib/work-plans.ts` has said
-- "No client" for a missing one since it was written.
alter table public.whitbyos_requests
  alter column client_id drop not null;
