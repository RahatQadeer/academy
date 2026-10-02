import { requireSuperAdmin } from "@/super-admin/lib/is-super-admin";

/**
 * Protected Super Admin shell. Sign-in lives under (auth) and does not use this layout.
 */
export default async function SuperAdminAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireSuperAdmin();
  return children;
}
