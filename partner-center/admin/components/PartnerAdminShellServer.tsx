import { requirePartnerAdmin } from "@/partner-center/admin/lib/require-partner-admin";
import { PartnerAdminShellClient } from "@/partner-center/admin/components/PartnerAdminShell";

export async function PartnerAdminShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requirePartnerAdmin();
  return (
    <PartnerAdminShellClient email={session.email}>
      {children}
    </PartnerAdminShellClient>
  );
}
