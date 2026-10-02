import { Logo, Wordmark } from "@/base/components/Logo";

/**
 * Staff auth chrome for Super Admin — same split as Partner auth
 * (form left, ink panel right), without product-specific program copy.
 */
export function SuperAdminAuthLayout({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <section className="flex items-center justify-center bg-canvas px-6 py-16">
        <div className="w-full max-w-[380px]">
          <div className="mb-9 flex items-center gap-2.5">
            <Logo size={26} />
            <span className="flex items-baseline gap-1.5">
              <Wordmark size={15} trademark />
              <span
                className="text-[13px] font-medium"
                style={{ color: "var(--text-tertiary)" }}
              >
                / Super Admin
              </span>
            </span>
          </div>

          <h1 className="text-[24px] font-bold leading-[1.1] tracking-[-0.4px]">
            {title}
          </h1>
          {description ? (
            <p
              className="mt-2 text-[14.5px] leading-relaxed"
              style={{ color: "var(--text-secondary)" }}
            >
              {description}
            </p>
          ) : null}

          <div className="mt-8">{children}</div>
          {footer ? <div className="mt-6">{footer}</div> : null}
        </div>
      </section>

      <section
        className="hidden flex-col px-14 py-12 lg:flex"
        style={{ background: "var(--ink)" }}
      >
        <SuperAdminAuthPanel />
      </section>
    </div>
  );
}

function SuperAdminAuthPanel() {
  const rows = [
    { label: "Access", value: "Staff only" },
    { label: "Provisioning", value: "Database" },
    { label: "Session", value: "2 hours" },
  ] as const;

  return (
    <div className="flex h-full flex-col justify-center text-white">
      <div className="max-w-[460px]">
        <p
          className="mb-4 text-[12.5px] font-semibold uppercase tracking-[0.08em]"
          style={{ color: "rgba(255,255,255,.65)" }}
        >
          Internal operations
        </p>
        <h2 className="text-[24px] font-bold leading-[1.1] tracking-[-0.4px]">
          Platform tools for Private Attaché staff.
        </h2>
        <p
          className="mt-5 text-[16px] leading-[1.6]"
          style={{ color: "rgba(255,255,255,.65)" }}
        >
          Sign in to review partners, applications, payouts, and program
          configuration. Accounts are provisioned in the database — there is no
          self-serve signup.
        </p>

        <div className="mt-9">
          {rows.map((row, index) => (
            <div
              key={row.label}
              className="flex items-center justify-between gap-6 py-3.5"
              style={{
                borderTop: "1px solid rgba(255,255,255,.28)",
                borderBottom:
                  index === rows.length - 1
                    ? "1px solid rgba(255,255,255,.28)"
                    : undefined,
              }}
            >
              <span
                className="text-[13.5px]"
                style={{ color: "rgba(255,255,255,.75)" }}
              >
                {row.label}
              </span>
              <span
                className="text-right text-[13.5px]"
                style={{ color: "rgba(255,255,255,.55)" }}
              >
                {row.value}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
