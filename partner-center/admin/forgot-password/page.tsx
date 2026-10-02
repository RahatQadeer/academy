import { PartnerAuthLayout } from "@/partner-center/auth/components/PartnerAuthLayout";
import { PartnerAdminForgotForm } from "@/partner-center/admin/components/PartnerAdminForgotForm";

export default function PartnerAdminForgotPasswordPage() {
  return (
    <PartnerAuthLayout
      title="Forgot password"
      description="We’ll email a reset link if this address has Partner Admin access."
    >
      <PartnerAdminForgotForm />
    </PartnerAuthLayout>
  );
}
