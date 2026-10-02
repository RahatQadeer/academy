import Link from "next/link";

/** F61 — Partner Center session expired (sign-in returns to partner routes). */
export function PartnerSessionExpired({ next }: { next?: string }) {
  const target =
    next && next.startsWith("/") && !next.startsWith("//") ? next : undefined;
  const href = target
    ? `/partner-center/signin?next=${encodeURIComponent(target)}`
    : "/partner-center/signin";

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center px-4"
      style={{ background: "rgba(55,53,47,.45)" }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="partner-session-expired-title"
    >
      <div className="w-full max-w-[400px] text-center">
        <div
          className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-full"
          style={{ background: "#f1f1ef", color: "rgba(55,53,47,.5)" }}
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
            <circle cx="12" cy="12" r="9.5" />
            <path d="M12 7v5l3.5 2" />
          </svg>
        </div>
        <h2 id="partner-session-expired-title" className="m-0 text-[20px] font-bold">
          Your session has expired
        </h2>
        <p
          className="mt-2 mb-6 text-[13.5px] leading-[1.5]"
          style={{ color: "rgba(55,53,47,.6)" }}
        >
          For your security, we signed you out after a period of inactivity. Sign
          back in to continue.
        </p>
        <Link
          href={href}
          className="inline-block w-full rounded-lg px-4 py-2.5 text-[14px] font-medium text-white no-underline hover:text-white"
          style={{ background: "var(--accent)" }}
        >
          Sign in again
        </Link>
      </div>
    </div>
  );
}
