import { redirect } from "next/navigation";
import { AuthLayout } from "@/base/components/AuthLayout";
import { SignInErrorPanel, SignInPanel } from "@/base/auth/panels";
import { LoginForm } from "@/base/auth/LoginForm";
import { partnerSignInHref, usesPartnerAuth } from "@/base/auth/query";
import { AcademyAuthPanel } from "@/academy/auth/AcademyAuthPanel";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; notice?: string; brand?: string; error?: string }>;
}) {
  const params = await searchParams;
  if (usesPartnerAuth({ brand: params.brand, next: params.next })) {
    redirect(partnerSignInHref());
  }
  const nextPath =
    params.next || (params.brand === "academy" ? "/academy" : "/switcher");
  const academy = params.brand === "academy";
  const portal = params.brand === "portal";
  const scope = academy
    ? "Academy"
    : params.brand === "partner"
      ? "Partner Center"
      : portal
        ? "Client Portal"
        : "Sign In";
  const title = academy ? "Sign in to the Academy" : "Welcome back";
  const subtitle = academy
    ? "One identity across Private Attaché, no separate Academy account needed."
    : portal
      ? "Access your Client Portal"
      : "Sign in to your workspace";

  return (
    <AuthLayout
      scope={scope}
      title={title}
      subtitle={subtitle}
      // 1.1 argues something different from 1: what a mistake costs, rather
      // than what the product is. The export gives the failure its own panel.
      panel={
        academy ? (
          <AcademyAuthPanel variant="login" />
        ) : params.error ? (
          <SignInErrorPanel />
        ) : (
          <SignInPanel />
        )
      }
      variant={portal ? "centered" : "split"}
    >
      {params.notice === "check-email" ? (
        <p className="text-[13.5px]" style={{ color: "var(--text-secondary)" }}>
          Check your email to confirm the account, then sign in.
        </p>
      ) : null}
      {/* Landing here after deleting an account, which otherwise looks like
          having been signed out for no reason. */}
      {params.notice === "account-deleted" ? (
        <p className="text-[13.5px]" style={{ color: "var(--text-secondary)" }}>
          Your account has been deleted. Signing in with it is no longer
          possible. If this was a mistake, ask your account team to invite you
          again.
        </p>
      ) : null}
      {/* Signed out by the firm closing its portal, which otherwise reads as
          having been locked out of an account. */}
      {params.notice === "portal-closed" ? (
        <p className="text-[13.5px]" style={{ color: "var(--text-secondary)" }}>
          Your adviser has closed their client portal for now, so there is
          nothing to sign in to. Your account and everything in it is
          untouched — they will reopen it when they are ready.
        </p>
      ) : null}
      {params.notice === "session-timeout" ? (
        <p className="text-[13.5px]" style={{ color: "var(--text-secondary)" }}>
          You were signed out because this device was left unused. Sign in
          again to continue. The time is set under Sign-in in Settings.
        </p>
      ) : null}
      <LoginForm nextPath={nextPath} brand={params.brand} initialError={params.error} />
    </AuthLayout>
  );
}
