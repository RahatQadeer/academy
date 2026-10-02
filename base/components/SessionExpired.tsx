import Link from "next/link";

/**
 * Screen 4.4 — Your session has expired.
 *
 * Shown when somebody's session ran out while they were part-way through
 * something. It exists because the alternative is worse: a form that refuses to
 * save with an error line, leaving them to guess whether they typed something
 * wrong or were simply gone too long.
 *
 * Not dismissible. Nothing behind it works until they sign in again, and a
 * dialog you can close over a screen that cannot do anything is a lie about the
 * state of it.
 *
 * `next` sends them back where they were — the export's "continue where you
 * left off" — and is a path from our own middleware, never a URL from a query
 * string, so it cannot be pointed at somewhere else.
 */
export function SessionExpired({ next }: { next?: string }) {
  const target = next && next.startsWith("/") && !next.startsWith("//") ? next : undefined;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center px-4"
      style={{ background: "rgba(55,53,47,.45)" }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="session-expired-title"
    >
      <div
        className="flex w-full max-w-[400px] flex-col items-center gap-[18px] rounded-[10px] bg-surface p-8 text-center"
        style={{ boxShadow: "0 12px 40px rgba(15,15,15,.18)" }}
      >
        <span
          className="flex h-11 w-11 items-center justify-center rounded-full text-[20px] font-bold"
          style={{ background: "var(--warning-bg)", color: "var(--warning-fg)" }}
          aria-hidden
        >
          !
        </span>

        <div className="flex flex-col gap-1.5">
          <h2 id="session-expired-title" className="text-[19px] font-bold">
            Your session has expired
          </h2>
          <p className="text-[13.5px] leading-[1.5]" style={{ color: "var(--text-secondary)" }}>
            For your security, please sign in again to continue where you left
            off.
          </p>
        </div>

        <Link
          href={target ? `/login?next=${encodeURIComponent(target)}` : "/login"}
          className="w-full rounded-control px-[18px] py-[11px] text-center text-[14.5px] font-medium text-white no-underline hover:text-white"
          style={{ background: "var(--accent)" }}
        >
          Sign in
        </Link>
      </div>
    </div>
  );
}
