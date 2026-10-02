import Link from "next/link";
import { Logo, Wordmark } from "@/base/components/Logo";
import { ModuleCard } from "@/base/components/ModuleCard";
import { SUPER_ADMIN_MODULES } from "@/super-admin/lib/modules";
import { SuperAdminSignOutButton } from "@/super-admin/auth/components/SuperAdminSignOutButton";
import { requireSuperAdmin } from "@/super-admin/lib/is-super-admin";

export default async function SuperAdminHubPage() {
  await requireSuperAdmin();

  return (
    <div className="min-h-screen bg-canvas px-6 py-10">
      <div className="mx-auto max-w-4xl">
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
          Internal operations
        </p>
        <h1 className="text-[32px] font-bold tracking-[-0.45px]">
          Choose a module
        </h1>
        <p className="mt-2 max-w-xl text-[15px]" style={{ color: "var(--text-secondary)" }}>
          Private Attaché staff tools for each product. Partner Center and
          Client Portal admin are available now; other modules will be added
          here.
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {SUPER_ADMIN_MODULES.map((module) =>
            module.available ? (
              <ModuleCard
                key={module.key}
                name={module.name}
                description={module.description}
                href={module.href}
                iconBg={module.iconBg}
                iconFg={module.iconFg}
                glyph={module.glyph}
                state="available"
                actionLabel={module.actionLabel}
              />
            ) : (
              <div
                key={module.key}
                className="rounded-card p-4 opacity-70"
                style={{
                  background: "var(--surface)",
                  border: "1px dashed var(--border-dashed)",
                }}
              >
                <span
                  className="mb-3 inline-flex h-[36px] w-[36px] items-center justify-center text-[13px] font-semibold"
                  style={{
                    background: module.iconBg,
                    color: module.iconFg,
                    borderRadius: 9,
                  }}
                >
                  {module.glyph}
                </span>
                <div className="text-[15px] font-semibold">{module.name}</div>
                <p
                  className="mt-1 text-[13.5px] leading-relaxed"
                  style={{ color: "var(--text-secondary)" }}
                >
                  {module.description}
                </p>
                <div
                  className="mt-3 text-[13px] font-medium"
                  style={{ color: "var(--text-tertiary)" }}
                >
                  {module.actionLabel}
                </div>
              </div>
            ),
          )}
        </div>

        <div className="mt-8 flex flex-wrap items-center gap-4">
          <Link
            href="/switcher"
            className="inline-block text-[13.5px]"
            style={{ color: "var(--text-secondary)" }}
          >
            ← Back to product switcher
          </Link>
        </div>
      </div>
    </div>
  );
}
