import { getStaffSession } from "@/super-admin/lib/staff-session";
import { SuperAdminAuthLayout } from "@/super-admin/auth/components/SuperAdminAuthLayout";
import { SuperAdminLoginForm } from "@/super-admin/auth/components/SuperAdminLoginForm";
import Link from "next/link";

/**
 * Public staff sign-in. Never redirects to the hub — middleware owns that bounce
 * for protected routes; this page only renders.
 */
export default async function SuperAdminSignInPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string }>;
}) {
  const params = searchParams ? await searchParams : {};
  const session = await getStaffSession();

  return (
    <SuperAdminAuthLayout
      title="Sign in"
      description="Use your Super Admin email and password. Sessions expire after 2 hours."
    >
      {session?.email ? (
        <p
          className="text-[14.5px] leading-relaxed"
          style={{ color: "var(--text-secondary)" }}
        >
          Signed in as {session.email}.{" "}
          <Link
            href="/super-admin"
            className="font-medium underline"
            style={{ color: "var(--accent)" }}
          >
            Continue to Super Admin
          </Link>
        </p>
      ) : (
        <SuperAdminLoginForm
          initialError={
            typeof params.error === "string" ? params.error : undefined
          }
        />
      )}
    </SuperAdminAuthLayout>
  );
}
