import Link from "next/link";
import { cn } from "@/base/lib/cn";

/**
 * URL-driven dialog. The design opens New Request and Add a Person over the
 * page behind them; using a query param instead of client state keeps those
 * pages server components and makes every modal linkable and back-button
 * friendly.
 *
 * Drawn the way Whitby draws its own, which this had drifted from in four ways
 * that all read as the portal being a cheaper product:
 *
 *   scrim      .28 of near-black, against Whitby's .45 of ink. The page behind
 *              stayed legible enough to keep reading, so the dialog looked like
 *              a panel that had landed on the screen rather than the only thing
 *              on it.
 *   card       an 8px radius with a border *and* a shadow. A bordered shadow is
 *              two answers to one question; Whitby's is 10px, shadow only.
 *   padding    24px against 32px, which is most of why it felt tighter.
 *   close      a bare glyph with no hit area and no hover, so the one control
 *              every dialog has was the one control that never answered the
 *              pointer.
 *
 * The height cap is new to both. The overlay has always scrolled, so a long
 * dialog was reachable, but the card itself ran the full height of its content
 * and pushed its own buttons past the fold: `my-auto` centres it while there is
 * room and collapses when there is not, which is the difference between a
 * dialog that scrolls and one that loses its first field.
 */
export function Modal({
  title,
  description,
  closeHref,
  children,
  width = 520,
  dense,
}: {
  title: string;
  description?: string;
  closeHref: string;
  children: React.ReactNode;
  width?: number;
  /** A tighter dialog, for the short confirmations. */
  dense?: boolean;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-6"
      style={{ background: "rgb(var(--chrome-ink-rgb) / .45)" }}
    >
      <Link href={closeHref} aria-label="Close" className="fixed inset-0" />

      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          "relative my-auto w-full rounded-card bg-surface",
          dense ? "px-[30px] py-7" : "p-8",
        )}
        style={{
          maxWidth: width,
          maxHeight: "calc(100vh - 48px)",
          overflowY: "auto",
          boxShadow: "0 12px 40px rgb(var(--shade-rgb) / .18)",
        }}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-[19px] font-bold">{title}</h2>
            {description ? (
              <p
                className="mt-1.5 text-[13.5px] leading-relaxed"
                style={{ color: "var(--text-soft)" }}
              >
                {description}
              </p>
            ) : null}
          </div>

          {/* A 28px square around the mark, pulled back by its own margin so
              the glyph stays where it is drawn: a close control you have to hit
              exactly is one you miss. */}
          <Link
            href={closeHref}
            aria-label="Close"
            className="-mr-1 -mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-[6px] leading-none no-underline transition-colors hover:bg-[var(--surface-active)]"
            // Every dialog in the reference draws the close mark at .4, and the
            // palette has no token there — .5 and .35 sit either side.
            style={{ fontSize: 15, color: "var(--text-quiet)" }}
          >
            ✕
          </Link>
        </div>

        {children}
      </div>
    </div>
  );
}
