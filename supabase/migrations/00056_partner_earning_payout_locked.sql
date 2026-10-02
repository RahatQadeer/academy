-- In-flight payout lock status (assumed default; not named in SRS §17.7.7).
-- Keeps `held` for the §17.1.12 new-partner waiting period only.
-- Cannot reference the new value in the same transaction as ADD VALUE.

alter type public.partner_earning_status add value if not exists 'payout_locked';
