import Link from "next/link";

/**
 * "← Back", the way 0.9c draws it.
 *
 * A breadcrumb says where you are; this says how to leave. Both can sit on a
 * screen, but only one of them is a control somebody looks for when they are
 * finished — so where a screen has both, the breadcrumb is the label and this
 * is the way out.
 *
 * Most screens had it and the Work Plan ones did not, which left the browser's
 * own button as the only route off a plan, a Work Stream or a task — and that
 * is not a route anybody sees.
 */
export function BackLink({ href, label = "Back" }: { href: string; label?: string }) {
  return (
    <Link
      href={href}
      className="pa-back-link -ml-1.5 mb-2.5 inline-flex items-center gap-1.5 rounded-control px-1.5 py-1 text-[12.5px] no-underline"
      style={{ color: "var(--text-tertiary)" }}
    >
      <span aria-hidden>←</span>
      {label}
    </Link>
  );
}
