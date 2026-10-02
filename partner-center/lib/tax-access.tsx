import {
  requirePartnerPrivilegedAccess,
  type PartnerPrivilegedAccess,
} from "@/partner-center/lib/access";
import { PartnerAccessDenied } from "@/partner-center/components/states/PartnerAccessDenied";

const TAX_DENIED =
  "Tax and payout setup is limited to Company Admins and Billing contacts. Ask your team's admin for access.";

export async function requirePartnerTaxMutationAccess(): Promise<
  PartnerPrivilegedAccess | { denied: true }
> {
  const access = await requirePartnerPrivilegedAccess();
  if (!access.privileged) {
    return { denied: true };
  }
  return access;
}

export function PartnerTaxAccessDenied() {
  return <PartnerAccessDenied description={TAX_DENIED} />;
}
