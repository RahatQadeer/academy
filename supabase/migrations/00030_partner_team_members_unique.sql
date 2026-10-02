-- Natural key: one membership per contact per partner profile (replay-safe accept).
-- Coordinate with Laiba (base/schema) before merge. Deduplicate existing rows first
-- if any environment already has duplicate (partner_profile_id, contact_id) pairs
-- (keep earliest created_at per pair).

delete from public.partner_team_members a
using public.partner_team_members b
where a.partner_profile_id = b.partner_profile_id
  and a.contact_id = b.contact_id
  and a.created_at > b.created_at;

create unique index if not exists partner_team_members_profile_contact_uidx
  on public.partner_team_members (partner_profile_id, contact_id);
