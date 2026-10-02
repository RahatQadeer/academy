-- Whitby referral program value. Unsigned signup uses existing `platform`.
-- Cannot reference the new value in the same transaction as ADD VALUE.

alter type public.partner_program_family add value if not exists 'whitbyos';
