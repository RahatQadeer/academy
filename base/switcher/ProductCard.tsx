import Link from "next/link";
import { cn } from "@/base/lib/cn";
import type { ProductMeta } from "@/base/switcher/products";

export function SwitcherProductCard({
  product,
  entitled,
  lockedReason,
  upgrade,
  index,
}: {
  product: ProductMeta;
  entitled: boolean;
  /**
   * Set when this product cannot be reached at all, rather than merely not
   * being subscribed to. The Client Portal is the case: it is opened by
   * accepting a professional's invitation and by no other route, so there is
   * nothing behind the card to explore and it is drawn as a closed door with
   * the reason on it rather than as a link that would refuse.
   */
  lockedReason?: string;
  /**
   * The plan does not include Client Portal. The card is the way onto one
   * that does, not a fourth product to open.
   */
  upgrade?: boolean;
  index: number;
}) {
  const href = upgrade
    ? "/whitbyos/settings/billing"
    : entitled
      ? product.href
      : product.applyHref || product.href;
  const action = upgrade ? "Upgrade your plan" : entitled ? "Open" : product.exploreLabel;

  if (upgrade) {
    return (
      <div className="pa-rise h-full" style={{ animationDelay: `${80 + index * 70}ms` }}>
        <Link
          href={href}
          className="pa-switcher-card group flex h-full flex-col overflow-hidden rounded-card bg-surface no-underline shadow-card transition-[border-color,transform,box-shadow] duration-150 hover:-translate-y-0.5 hover:shadow-float hover:!text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          style={{ color: "var(--ink)", ["--card-accent" as string]: product.iconFg }}
        >
          <div
            className="relative flex h-11 items-center overflow-hidden px-3.5"
            style={{ background: product.iconBg }}
          >
            <span
              className="relative z-[1] flex h-7 w-7 items-center justify-center text-[11px] font-semibold"
              style={{
                background: "var(--surface)",
                color: product.iconFg,
                borderRadius: 8,
              }}
              aria-hidden
            >
              {product.glyph}
            </span>
          </div>
          <div className="flex flex-1 flex-col px-3.5 py-3">
            <div className="truncate text-[14px] font-semibold">Enable Client Portal</div>
            <p className="mt-0.5 text-[12.5px] leading-snug" style={{ color: "var(--text-secondary)" }}>
              Upgrade your plan
            </p>
            <div className="mt-2 text-[12.5px] font-medium" style={{ color: product.iconFg }}>
              {action} →
            </div>
          </div>
        </Link>
      </div>
    );
  }

  if (lockedReason) {
    return (
      <div className="pa-rise h-full" style={{ animationDelay: `${80 + index * 70}ms` }}>
        <div
          className="pa-switcher-card is-muted flex h-full cursor-not-allowed flex-col overflow-hidden rounded-card bg-surface opacity-70 shadow-card"
          style={{ color: "var(--ink)" }}
          aria-disabled="true"
        >
          {/* The header keeps the product's own colour so it is still
              recognisably the Client Portal, and is desaturated so it is
              plainly not open. */}
          <div
            className="relative flex h-11 items-center overflow-hidden px-3.5"
            style={{ background: product.iconBg, filter: "saturate(.45)" }}
          >
            <span
              className="relative z-[1] flex h-7 w-7 items-center justify-center text-[11px] font-semibold"
              style={{
                background: "var(--surface)",
                color: "var(--text-tertiary)",
                borderRadius: 8,
              }}
              aria-hidden
            >
              {product.glyph}
            </span>
          </div>

          <div className="flex flex-1 flex-col px-3.5 py-3">
            <div className="truncate text-[14px] font-semibold">{product.name}</div>
            <p
              className="mt-0.5 text-[12.5px] leading-snug"
              style={{ color: "var(--text-secondary)" }}
            >
              {lockedReason}
            </p>
            <div
              className="mt-2 flex items-center gap-1.5 text-[12.5px] font-medium"
              style={{ color: "var(--text-faint)" }}
            >
              <LockGlyph />
              By invitation only
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="pa-rise h-full" style={{ animationDelay: `${80 + index * 70}ms` }}>
      <Link
        href={href}
        className={cn(
          "pa-switcher-card group flex h-full flex-col overflow-hidden rounded-card bg-surface no-underline shadow-card",
          "transition-[border-color,transform,box-shadow] duration-150",
          "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
          entitled ? "hover:-translate-y-0.5 hover:shadow-float" : "is-muted opacity-80",
        )}
        style={{
          color: "var(--ink)",
          ["--card-accent" as string]: product.iconFg,
        }}
      >
        <div
          className="relative flex h-11 items-center overflow-hidden px-3.5"
          style={{ background: product.iconBg }}
        >
          <span
            className="pointer-events-none absolute -right-6 -top-8 h-20 w-20 rounded-full"
            style={{ background: product.iconFg, opacity: 0.12 }}
            aria-hidden
          />
          <span
            className="relative z-[1] flex h-7 w-7 items-center justify-center text-[11px] font-semibold"
            style={{
              background: "var(--surface)",
              color: product.iconFg,
              borderRadius: 8,
            }}
            aria-hidden
          >
            {product.glyph}
          </span>
        </div>

        <div className="flex flex-1 flex-col px-3.5 py-3">
          <div className="truncate text-[14px] font-semibold">{product.name}</div>
          <p
            className="mt-0.5 truncate text-[12.5px] leading-snug"
            style={{ color: "var(--text-secondary)" }}
          >
            {product.tagline}
          </p>
          <div className="mt-2 text-[12.5px] font-medium" style={{ color: product.iconFg }}>
            {action} →
          </div>
        </div>
      </Link>
    </div>
  );
}

/** Small enough that a stroked padlock would close up; this one stays open. */
function LockGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor"
         strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0" aria-hidden>
      <rect x="4.5" y="10.5" width="15" height="9.5" rx="2.5" />
      <path d="M8.2 10.5V7.8a3.8 3.8 0 0 1 7.6 0v2.7" />
    </svg>
  );
}
