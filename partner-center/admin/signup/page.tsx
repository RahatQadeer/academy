import Link from "next/link";
import { PartnerAuthLayout } from "@/partner-center/auth/components/PartnerAuthLayout";
import { PartnerAdminSignUpForm } from "@/partner-center/admin/components/PartnerAdminSignUpForm";
import { lookupInviteByToken } from "@/partner-center/admin/lib/invite";
import { PARTNER_ADMIN_GENERIC_ERROR } from "@/partner-center/admin/lib/shared";
import { PA_ADMIN } from "@/partner-center/admin/lib/paths";

export default async function PartnerAdminSignUpPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = (await searchParams) ?? {};
  const token = typeof query.token === "string" ? query.token : "";
  const row = token ? await lookupInviteByToken(token) : null;

  if (!row) {
    return (
      <PartnerAuthLayout
        title="Partner Admin"
        description=""
        backHref={PA_ADMIN.signin}
        backLabel="Back to Partner Admin sign in"
      >
        <p className="text-[13.5px]" style={{ color: "var(--danger-fg)" }}>
          {PARTNER_ADMIN_GENERIC_ERROR}
        </p>
        <p className="mt-3 text-[13px]" style={{ color: "var(--text-secondary)" }}>
          If your email link expired, ask your Super Admin for a new invite, or{" "}
          <Link href={PA_ADMIN.signin} className="underline">
            sign in
          </Link>{" "}
          if you already set a password.
        </p>
      </PartnerAuthLayout>
    );
  }

  return (
    <PartnerAuthLayout
      title="Set up your account"
      description="Create a password for Partner Admin. You’ll go straight to the admin dashboard."
      backHref={PA_ADMIN.signin}
      backLabel="Back to Partner Admin sign in"
    >
      <PartnerAdminSignUpForm token={token} email={row.email} />
    </PartnerAuthLayout>
  );
}
