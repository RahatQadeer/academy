import { AuthLayout } from "@/base/components/AuthLayout";
import { Button } from "@/base/components/Button";
import { ConfirmedPanel, VerifyEmailPanel } from "@/base/auth/panels";
import { createClient, isSupabaseConfigured } from "@/base/lib/supabase/server";

export default async function ConfirmedPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const configured = isSupabaseConfigured();
  let signedIn = false;

  if (configured) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    signedIn = Boolean(user);
  }

  if (params.error) {
    return (
      <AuthLayout
        scope="Verify Email"
        title="Could not confirm"
        subtitle={params.error}
        panel={<VerifyEmailPanel />}
      >
        <Button href="/login" variant="primary" fullWidth>
          Back to sign in
        </Button>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      scope="Verify Email"
      title="Account confirmed"
      subtitle="Your email is confirmed. You can continue into Private Attaché."
      glyph={{ mark: "✓", tone: "success" }}
      panel={<ConfirmedPanel />}
    >
      <Button href={signedIn ? "/switcher" : "/login"} variant="primary" fullWidth>
        {signedIn ? "Continue" : "Sign in"}
      </Button>
    </AuthLayout>
  );
}
