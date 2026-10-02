import { PartnerAuthLayout } from "@/partner-center/auth/components/PartnerAuthLayout";
import { PartnerResetPasswordForm } from "@/partner-center/auth/components/PartnerResetPasswordForm";

export default function PartnerResetPasswordPage() {
  return (
    <PartnerAuthLayout
      title="Set a new password"
      description="Choose a strong password for your partner account."
    >
      <PartnerResetPasswordForm />
    </PartnerAuthLayout>
  );
}
