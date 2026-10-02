import { ForgotPasswordForm } from "@/base/auth/ForgotPasswordForm";
import { PartnerAuthLayout } from "@/partner-center/auth/components/PartnerAuthLayout";

export default function PartnerForgotPasswordPage() {
  return (
    <PartnerAuthLayout
      title="Reset your password"
      description="Enter the email on your partner account and we'll send you a reset link."
      backHref="/partner-center/signin"
    >
      <ForgotPasswordForm signInHref="/partner-center/signin" />
    </PartnerAuthLayout>
  );
}
