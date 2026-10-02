import type { ReactNode } from "react";

/**
 * What this screen is, and the one thing to try on it.
 *
 * The demo used to sit up on the bar beside the account menu, which is
 * where a product puts the things you reach for while working — and a demo
 * is the opposite of that: it is for somebody who has not started. It
 * belongs next to the sentence explaining the screen, which is the only
 * other thing here addressed to a person who has just arrived.
 */
export function OverviewLanding({
  showClients,
  aside,
}: {
  showClients: boolean;
  /** Shown beside the copy — the demo, on a screen that has one. */
  aside?: ReactNode;
}) {
  return (
    // The flex, the wrap and the centring are `.ws-hero`'s own, in the
    // stylesheet. Repeating them here as utilities is a second opinion about
    // the same box, and the built CSS decides which one lands.
    <section className="ws-hero mb-6">
      <div className="min-w-0 max-w-[560px]">
        <h2 className="ws-hero-title">
          {showClients ? "Every client. One look." : "The firm, at a glance."}
        </h2>
        <p className="mt-2 text-[14.5px] leading-[1.55]" style={{ color: "var(--text-secondary)" }}>
          {showClients
            ? "What is due, what is late, and how the firm is doing, across every client at once. Open a workspace on the left when you want to do the work."
            : "What is due, what is late, and what is still open."}
        </p>
      </div>

      {/*
       * Level with the copy, off to the right.
       *
       * Under the sentence it sat below the card's last line and left the
       * whole right half of a very wide card empty. Hard against the far
       * edge it was stranded. Centred on the copy and given the card's own
       * padding to stand in, it reads as the other half of the same row —
       * and it wraps under on a narrow screen, where there is no right
       * half to be on.
       */}
      {aside ? <div className="shrink-0 sm:pr-4 lg:pr-10">{aside}</div> : null}
    </section>
  );
}
