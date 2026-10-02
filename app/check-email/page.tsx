import { AuthLayout } from "@/base/components/AuthLayout";
import { CheckEmailPanel } from "@/base/auth/CheckEmailPanel";
import {
  CheckEmailPanel as CheckEmailAside,
  VerifyEmailPanel,
} from "@/base/auth/panels";

export default async function CheckEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string; reason?: string }>;
}) {
  const params = await searchParams;
  // 2.1 and 3.1 are the same screen with different words: one confirms a new
  // account, the other a password reset.
  const reset = params.reason === "reset";

  return (
    <AuthLayout
      scope={reset ? "Reset Password" : "Verify Email"}
      title="Check your email"
      glyph={{ mark: "✉", tone: "accent" }}
      panel={reset ? <CheckEmailAside /> : <VerifyEmailPanel />}
    >
      <CheckEmailPanel email={params.email} reset={reset} />
    </AuthLayout>
  );
}
