import { PartnerAuthLayout } from "@/partner-center/auth/components/PartnerAuthLayout";
import { PartnerAdminResetForm } from "@/partner-center/admin/components/PartnerAdminResetForm";

export default function PartnerAdminResetPasswordPage() {
  return (
    <PartnerAuthLayout
      title="Reset password"
      description="Choose a new password for Partner Admin."
    >
      <PartnerAdminResetForm />
    </PartnerAuthLayout>
  );
}
