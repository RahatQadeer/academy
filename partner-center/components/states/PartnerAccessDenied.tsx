import Link from "next/link";
import { PARTNER_PATHS } from "@/partner-center/lib/review-state";

export function PartnerAccessDenied({
  description = "This area is limited to Company Admins. Ask your team's admin for access.",
}: {
  description?: string;
}) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-8 py-12 text-center">
      <div
        className="mb-4 flex h-11 w-11 items-center justify-center rounded-full"
        style={{ background: "#fdf7ee", color: "#8a6229" }}
        aria-hidden
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="4.5" y="10.5" width="15" height="10" rx="2" />
          <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
        </svg>
      </div>
      <h1 className="m-0 text-[16px] font-semibold">You don&apos;t have access</h1>
      <p
        className="mt-1.5 mb-5 max-w-[280px] text-[13.5px] leading-[1.5]"
        style={{ color: "rgba(55,53,47,.5)" }}
      >
        {description}
      </p>
      <Link
        href={PARTNER_PATHS.app}
        className="inline-flex items-center justify-center rounded-lg border px-4 py-2.5 text-[13.5px] font-medium no-underline"
        style={{ color: "var(--ink)", borderColor: "#d6d4d0" }}
      >
        Back to Home
      </Link>
    </div>
  );
}
