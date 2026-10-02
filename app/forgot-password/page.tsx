import { redirect } from "next/navigation";
import { AuthLayout } from "@/base/components/AuthLayout";
import { ForgotPasswordPanel } from "@/base/auth/panels";
import { ForgotPasswordForm } from "@/base/auth/ForgotPasswordForm";
import { isPartnerNext } from "@/base/auth/query";

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; brand?: string }>;
}) {
  const params = await searchParams;
  if (params.brand === "partner" || isPartnerNext(params.next)) {
    redirect("/partner-center/forgot-password");
  }

  return (
    <AuthLayout
      scope="Reset Password"
      title="Reset your password"
      subtitle="Enter the email associated with your account and we'll send a reset link."
      panel={<ForgotPasswordPanel />}
    >
      <ForgotPasswordForm />
    </AuthLayout>
  );
}
