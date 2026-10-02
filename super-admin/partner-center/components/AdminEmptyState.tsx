import Link from "next/link";
import { cn } from "@/base/lib/cn";
import { pcType } from "@/super-admin/partner-center/lib/typography";

export function AdminEmptyState({
  title,
  description,
  actionHref,
  actionLabel,
}: {
  title: string;
  description: string;
  actionHref?: string;
  actionLabel?: string;
}) {
  return (
    <div className="pa-partner-card px-6 py-10 text-center">
      <p className={pcType.title}>{title}</p>
      <p
        className={cn("mx-auto mt-2 max-w-md leading-relaxed", pcType.body)}
        style={{ color: "var(--text-secondary)" }}
      >
        {description}
      </p>
      {actionHref && actionLabel ? (
        <Link
          href={actionHref}
          className={cn("mt-4 inline-block no-underline", pcType.bodyMedium)}
          style={{ color: "var(--accent)" }}
        >
          {actionLabel}
        </Link>
      ) : null}
    </div>
  );
}
