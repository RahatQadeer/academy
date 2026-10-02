import Link from "next/link";
import { PARTNER_PATHS } from "@/partner-center/lib/review-state";

export function PartnerNotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-8 py-12 text-center">
      <div
        className="mb-2 text-[24px] font-bold leading-none"
        style={{ color: "rgba(55,53,47,.2)" }}
      >
        404
      </div>
      <h1 className="m-0 text-[16px] font-semibold">Page not found</h1>
      <p
        className="mt-1.5 mb-5 max-w-[280px] text-[13.5px] leading-[1.5]"
        style={{ color: "rgba(55,53,47,.5)" }}
      >
        The page you&apos;re looking for doesn&apos;t exist or may have moved.
      </p>
      <Link
        href={PARTNER_PATHS.app}
        className="inline-flex items-center justify-center rounded-lg px-4 py-2.5 text-[13.5px] font-medium text-white no-underline hover:text-white"
        style={{ background: "var(--accent)" }}
      >
        Back to Home
      </Link>
    </div>
  );
}
