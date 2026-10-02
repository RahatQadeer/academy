import { redirect } from "next/navigation";
import { AuthLayout } from "@/base/components/AuthLayout";
import { SignupForm } from "@/base/auth/SignupForm";
import { partnerApplyHref, usesPartnerAuth } from "@/base/auth/query";
import { AcademyAuthPanel } from "@/academy/auth/AcademyAuthPanel";
import { SignUpPanel } from "@/base/auth/panels";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; brand?: string }>;
}) {
  const params = await searchParams;
  if (usesPartnerAuth({ brand: params.brand, next: params.next })) {
    redirect(partnerApplyHref());
  }
  const academy = params.brand === "academy";
  const title = "Create your account";
  const subtitle = academy
    ? "This becomes your one identity across the Academy, Whitby, and the Partner Center."
    : "Start your 14-day free trial, no card required";

  return (
    <AuthLayout
      scope={academy ? "Academy" : "Sign Up"}
      title={title}
      subtitle={subtitle}
      panel={academy ? <AcademyAuthPanel variant="signup" /> : <SignUpPanel />}
    >
      <SignupForm nextPath={params.next || "/switcher"} brand={params.brand} />
    </AuthLayout>
  );
}
