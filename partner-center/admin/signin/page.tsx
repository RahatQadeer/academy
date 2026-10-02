import { PartnerAuthLayout } from "@/partner-center/auth/components/PartnerAuthLayout";
import { PartnerAdminSignInForm } from "@/partner-center/admin/components/PartnerAdminSignInForm";
import { getActivePartnerAdmin } from "@/partner-center/admin/lib/require-partner-admin";
import { sanitizePartnerAdminNext } from "@/partner-center/admin/lib/shared";
import { PA_ADMIN } from "@/partner-center/admin/lib/paths";
import { redirect } from "next/navigation";

export default async function PartnerAdminSignInPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = (await searchParams) ?? {};
  const errorRaw = typeof query.error === "string" ? query.error : undefined;
  const email = typeof query.email === "string" ? query.email : "";
  const next = sanitizePartnerAdminNext(
    typeof query.next === "string" ? query.next : undefined,
  );

  const session = await getActivePartnerAdmin();
  if (session) redirect(PA_ADMIN.root);

  return (
    <PartnerAuthLayout
      title="Partner Admin"
      description="Sign in to oversee partners, applications, and Partner Manager conversations."
    >
      <PartnerAdminSignInForm
        initialEmail={email}
        initialError={
          errorRaw === "denied"
            ? "Sign-in is not available for this account."
            : undefined
        }
        nextPath={next}
      />
    </PartnerAuthLayout>
  );
}
