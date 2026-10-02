import { redirect } from "next/navigation";
import { AuthLayout } from "@/base/components/AuthLayout";
import { VerifyIdentityPanel } from "@/base/auth/panels";
import { VerifyForm } from "@/app/verify/VerifyForm";
import { createClient, isSupabaseConfigured } from "@/base/lib/supabase/server";

/** Screen 1.2 — Verify Your Identity. */
export default async function VerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const params = await searchParams;
  const next = params.next && params.next.startsWith("/") ? params.next : "/switcher";

  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) redirect("/login");

    // Somebody who is already through, or who has no second factor, has no
    // business on this page — it would ask them for a code nothing can accept.
    const { data: assurance } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (assurance?.currentLevel === "aal2" || assurance?.nextLevel !== "aal2") {
      redirect(next);
    }
  }

  return (
    <AuthLayout
      scope="Verify Identity"
      title="Verify your identity"
      subtitle="Enter the 6-digit code from your authenticator app"
      panel={<VerifyIdentityPanel />}
    >
      <VerifyForm next={next} />
    </AuthLayout>
  );
}
