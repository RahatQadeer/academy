import Link from "next/link";
import { Logo, Wordmark } from "@/base/components/Logo";
import { Callout } from "@/base/components/Callout";
import { SuperAdminSignOutButton } from "@/super-admin/auth/components/SuperAdminSignOutButton";
import { requireSuperAdmin } from "@/super-admin/lib/is-super-admin";
import { loadWorkspaceSeats } from "@/super-admin/client-portal/lib/load-workspaces";
import { WorkspaceSeatsBoard } from "@/super-admin/client-portal/components/WorkspaceSeatsBoard";

/**
 * Client Portal admin. Portal seats are all of it for now.
 *
 * The number used to be the professional's to set, per client, from the
 * Account section in Whitby. It is a commercial decision rather than an
 * operational one, so supabase/00056 moved both figures onto `workspaces` and
 * this screen is where they are set. A workspace's number applies to every
 * client account in it.
 *
 * Filed under the Client Portal rather than in a platform section: the row it
 * writes belongs to a workspace, but the rule it expresses is a portal one —
 * how many people a client account may hold.
 */
export default async function ClientPortalAdminPage() {
  await requireSuperAdmin();
  const result = await loadWorkspaceSeats();

  return (
    <div className="min-h-screen bg-canvas px-6 py-10">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <Logo size={26} />
            <span className="flex items-baseline gap-1.5">
              <Wordmark size={16} trademark />
              <span
                className="text-[13px] font-medium"
                style={{ color: "var(--text-tertiary)" }}
              >
                / Super Admin
              </span>
            </span>
          </div>
          <SuperAdminSignOutButton className="text-[13.5px] font-medium" />
        </div>

        <p
          className="mb-2 text-[12.5px] font-semibold uppercase tracking-[0.06em]"
          style={{ color: "var(--text-tertiary)" }}
        >
          Client Portal
        </p>
        <h1 className="text-[32px] font-bold tracking-[-0.45px]">
          People &amp; access limits
        </h1>
        <p
          className="mt-2 max-w-2xl text-[15px]"
          style={{ color: "var(--text-secondary)" }}
        >
          How many people each client account may hold, set per workspace. The
          baseline is 10 additional members — raise it for a workspace that has
          bought more.
        </p>

        <div className="mt-8">
          {!result.configured ? (
            <Callout tone="warning" title="Supabase admin is not connected">
              Set <code>NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
              <code>SUPABASE_SERVICE_ROLE_KEY</code> to load and change
              workspace limits.
            </Callout>
          ) : result.error ? (
            <Callout tone="danger" title="Could not load workspaces">
              {result.error}
            </Callout>
          ) : (
            <WorkspaceSeatsBoard items={result.items} />
          )}
        </div>

        <div className="mt-8">
          <Link
            href="/super-admin"
            className="inline-block text-[13.5px]"
            style={{ color: "var(--text-secondary)" }}
          >
            ← Back to Super Admin
          </Link>
        </div>
      </div>
    </div>
  );
}
