-- Allow Academy Admins to delete training workspaces when removing a program.
-- Enrollments and credentials already have admin delete policies; this table did not.

drop policy if exists academy_training_write on public.academy_training_workspaces;
create policy academy_training_write on public.academy_training_workspaces
  for all using (
    public.has_academy_entitlement()
    and public.is_academy_admin()
  )
  with check (
    public.has_academy_entitlement()
    and public.is_academy_admin()
  );

grant select, insert, update, delete on public.academy_training_workspaces to authenticated, service_role;
