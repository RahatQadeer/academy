import { AuthLayout } from "@/base/components/AuthLayout";
import { ResetPasswordPanel } from "@/base/auth/panels";
import { ResetPasswordForm } from "@/base/auth/ResetPasswordForm";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) ?? {};
  const raw = params.token_hash;
  const tokenHash = Array.isArray(raw) ? raw[0] : raw;

  return (
    <AuthLayout
      scope="Reset Password"
      title="Create new password"
      subtitle="Your new password must be different from previously used passwords."
      panel={<ResetPasswordPanel />}
    >
      {/* The token from the email, spent when the form is sent rather than
          when the link is opened. See the recovery branch of /auth/callback. */}
      <ResetPasswordForm tokenHash={tokenHash ?? null} />
    </AuthLayout>
  );
}
