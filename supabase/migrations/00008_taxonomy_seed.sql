-- Shared Category / Subcategory taxonomy (SRS Section 10).
-- Twenty-four top-level categories are seeded now. The 250+ subcategory workbook
-- is supplemental reference data and should be imported after client review.

insert into public.taxonomy_categories (id, slug, name, sort_order, active, default_sensitivity) values
  ('CAT-0010', 'admin-documents', 'Admin / Documents', 10, true, 'normal'),
  ('CAT-0020', 'aviation', 'Aviation', 20, true, 'normal'),
  ('CAT-0030', 'dental', 'Dental', 30, true, 'sensitive'),
  ('CAT-0040', 'education', 'Education', 40, true, 'normal'),
  ('CAT-0050', 'family-support', 'Family Support', 50, true, 'sensitive'),
  ('CAT-0060', 'financial-tax', 'Financial / Tax', 60, true, 'sensitive'),
  ('CAT-0070', 'home-services', 'Home Services', 70, true, 'normal'),
  ('CAT-0080', 'hospitality-experiences', 'Hospitality / Experiences', 80, true, 'normal'),
  ('CAT-0090', 'household-staffing', 'Household Staffing', 90, true, 'sensitive'),
  ('CAT-0100', 'housing-relocation', 'Housing / Relocation', 100, true, 'normal'),
  ('CAT-0110', 'insurance', 'Insurance', 110, true, 'sensitive'),
  ('CAT-0120', 'language', 'Language', 120, true, 'normal'),
  ('CAT-0130', 'legal', 'Legal', 130, true, 'sensitive'),
  ('CAT-0140', 'medical', 'Medical', 140, true, 'sensitive'),
  ('CAT-0150', 'mental-health', 'Mental Health', 150, true, 'sensitive'),
  ('CAT-0160', 'personal-assistance', 'Personal Assistance', 160, true, 'normal'),
  ('CAT-0170', 'pets', 'Pets', 170, true, 'normal'),
  ('CAT-0180', 'property-residence', 'Property / Residence', 180, true, 'normal'),
  ('CAT-0190', 'security-safety', 'Security / Safety', 190, true, 'sensitive'),
  ('CAT-0200', 'technology-support', 'Technology Support', 200, true, 'normal'),
  ('CAT-0210', 'transportation', 'Transportation', 210, true, 'normal'),
  ('CAT-0220', 'travel', 'Travel', 220, true, 'normal'),
  ('CAT-0230', 'wellness-personal-care', 'Wellness / Personal Care', 230, true, 'sensitive'),
  ('CAT-0240', 'other-needs-review', 'Other / Needs Review', 240, true, 'normal');

insert into public.taxonomy_subcategories (id, parent_category_id, slug, name, sort_order, active, default_sensitivity) values
  ('SUB-0100-10', 'CAT-0100', 'school-search', 'School search', 10, true, 'normal'),
  ('SUB-0100-20', 'CAT-0100', 'temporary-housing', 'Temporary housing', 20, true, 'normal'),
  ('SUB-0100-30', 'CAT-0100', 'permanent-residence', 'Permanent residence', 30, true, 'normal'),
  ('SUB-0140-10', 'CAT-0140', 'specialist-care', 'Specialist care', 10, true, 'sensitive'),
  ('SUB-0190-10', 'CAT-0190', 'residential-security', 'Residential security', 10, true, 'sensitive'),
  ('SUB-0220-10', 'CAT-0220', 'private-aviation-travel', 'Private aviation travel', 10, true, 'normal');
