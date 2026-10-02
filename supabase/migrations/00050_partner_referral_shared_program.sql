-- Unsigned shared-link signup rows use program = shared until the referred
-- user enters Academy or Whitby (platform). Then the row is promoted.
-- Value cannot be referenced in the same transaction; check widens in 00051.

alter type public.partner_program_family add value if not exists 'shared';
