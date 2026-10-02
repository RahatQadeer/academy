-- Storage buckets. Signed URLs only — never public for gated content.

insert into storage.buckets (id, name, public)
values
  ('documents', 'documents', false),
  ('avatars', 'avatars', false),
  ('academy', 'academy', false)
on conflict (id) do nothing;

create policy storage_documents_authenticated
  on storage.objects
  for all
  using (bucket_id in ('documents', 'avatars', 'academy') and auth.role() = 'authenticated')
  with check (bucket_id in ('documents', 'avatars', 'academy') and auth.role() = 'authenticated');
