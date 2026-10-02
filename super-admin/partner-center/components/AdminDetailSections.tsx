import Link from "next/link";
import { cn } from "@/base/lib/cn";
import { pcType } from "@/super-admin/partner-center/lib/typography";

export function AdminDetailSection({
  title,
  children,
  variant = "fields",
}: {
  title: string;
  children: React.ReactNode;
  /** `fields` = dl grid for AdminDetailField. `form` = block body for controls. */
  variant?: "fields" | "form";
}) {
  return (
    <section className="pa-partner-card px-4 py-3.5 sm:px-5">
      <h2 className={cn("mb-3 tracking-[-0.1px]", pcType.bodyStrong)}>
        {title}
      </h2>
      {variant === "form" ? (
        <div>{children}</div>
      ) : (
        <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
          {children}
        </dl>
      )}
    </section>
  );
}

/** Shared 2-col track for admin form controls so fields line up across cards. */
export function AdminFormGrid({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("grid grid-cols-1 gap-4 sm:grid-cols-2", className)}>
      {children}
    </div>
  );
}

function displayDetailValue(value: React.ReactNode): React.ReactNode {
  if (value == null || value === false) return "—";
  if (typeof value === "string") return value.trim() ? value : "—";
  if (typeof value === "number") {
    return Number.isFinite(value) ? String(value) : "—";
  }
  if (typeof value === "bigint") return value.toString();
  // Plain objects crash React ("Objects are not valid as a React child").
  if (typeof value === "object" && !Array.isArray(value) && !("$$typeof" in value)) {
    return "—";
  }
  return value || "—";
}

export function AdminDetailField({
  label,
  value,
  fullWidth,
}: {
  label: string;
  value: React.ReactNode;
  fullWidth?: boolean;
}) {
  return (
    <div className={fullWidth ? "sm:col-span-2 lg:col-span-3" : undefined}>
      <dt
        className={cn(
          "uppercase tracking-[0.04em] font-semibold",
          pcType.meta,
        )}
        style={{ color: "var(--text-tertiary)" }}
      >
        {label}
      </dt>
      <dd
        className={cn("mt-0.5 leading-snug break-words", pcType.body)}
        style={{ color: "var(--ink)" }}
      >
        {displayDetailValue(value)}
      </dd>
    </div>
  );
}

export function AdminBackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className={cn("mb-4 inline-block no-underline", pcType.subtitle)}
      style={{ color: "var(--text-secondary)" }}
    >
      ← {label}
    </Link>
  );
}

export function AdminActionBar({ children }: { children: React.ReactNode }) {
  return (
    <div className="pa-partner-card mt-5 flex flex-wrap gap-2 px-4 py-3.5 sm:px-5">
      {children}
    </div>
  );
}
