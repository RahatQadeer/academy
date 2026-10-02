import Link from "next/link";
import { Logo, Wordmark } from "@/base/components/Logo";
import { PartnerAuthPanel } from "@/partner-center/components/PartnerAuthPanel";

export function PartnerAuthLayout({
  title,
  description,
  backHref,
  backLabel = "Back to sign in",
  children,
  footer,
}: {
  title: string;
  description?: string;
  backHref?: string;
  backLabel?: string;
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
                / Partner Center
              </span>
            </span>
          </div>
          {backHref ? (
            <Link
              href={backHref}
              className="mb-3 inline-block text-[13px] no-underline"
              style={{ color: "var(--text-tertiary)" }}
            >
              ← {backLabel}
            </Link>
          ) : null}
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
        <PartnerAuthPanel />
      </section>
    </div>
  );
}
