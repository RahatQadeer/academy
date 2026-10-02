import Link from "next/link";
import { AlertCircle } from "lucide-react";
import { SUPPORT_MAILTO } from "@/partner-center/lib/review-state";

export function PartnerLoadError({
  retryHref,
  message,
}: {
  retryHref: string;
  message?: string;
}) {
  const body =
    message?.trim() ||
    "We couldn't load this page. Check your connection and try again — if this keeps happening, contact support.";

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center px-8 py-12 text-center">
      <div
        className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl"
        style={{ background: "var(--danger-bg)", color: "var(--danger-fg)" }}
        aria-hidden
      >
        <AlertCircle size={28} strokeWidth={2} />
      </div>
      <h2 className="m-0 text-[20px] font-bold">Something went wrong</h2>
      <p
        className="mx-auto mt-2 mb-5 max-w-md text-[13.5px] leading-relaxed"
        style={{ color: "var(--text-secondary)" }}
      >
        {body}
      </p>
      <div className="flex flex-wrap justify-center gap-2.5">
        <Link
          href={SUPPORT_MAILTO}
          className="inline-flex items-center justify-center rounded-lg border border-line px-4 py-2.5 text-[13.5px] font-medium no-underline"
          style={{ color: "var(--ink)" }}
        >
          Contact support
        </Link>
        <Link
          href={retryHref}
          className="inline-flex items-center justify-center rounded-lg px-4 py-2.5 text-[13.5px] font-medium text-white no-underline hover:text-white"
          style={{ background: "var(--accent)" }}
        >
          Try again
        </Link>
      </div>
    </div>
  );
}
