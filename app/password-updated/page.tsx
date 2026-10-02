import { AuthLayout } from "@/base/components/AuthLayout";
import { Button } from "@/base/components/Button";
import { PasswordUpdatedPanel } from "@/base/auth/panels";
import { SignOutOnMount } from "./SignOutOnMount";

/**
 * Figma 3.3 — Password Updated.
 *
 * Reset leaves a session, but this screen's CTA is "Continue to sign in".
 * Signing out here (not in the reset route) keeps Partner Center's own
 * continue-into-product path, and lets portal users skip this page entirely.
 */
export default function PasswordUpdatedPage() {
  return (
    <AuthLayout
      scope="Reset Password"
      title="Password updated"
      subtitle="Your password has been changed successfully."
      glyph={{ mark: "✓", tone: "success" }}
      panel={<PasswordUpdatedPanel />}
    >
      <SignOutOnMount />
      <Button href="/login" variant="primary" fullWidth>
        Continue to sign in
      </Button>
    </AuthLayout>
  );
}
