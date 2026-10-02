"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { SpecialtyPreviewScene } from "@/base/landing/brand/AcademyIllustrations";
import { IconArrow } from "@/base/landing/brand/Icons";
import { SPECIALTY_PROGRAMS } from "@/base/landing/content";
import { moduleHref } from "@/base/landing/modules";
import { cn } from "@/base/lib/cn";

/** Only the first five specialties are shown in the deck. */
const DECK_PROGRAMS = SPECIALTY_PROGRAMS.slice(0, 5);
const COUNT = DECK_PROGRAMS.length;
/** How many cards peek out behind the front card. */
const VISIBLE_BEHIND = 3;

/** One tint per specialty: [background, deep accent]. */
const CARD_TINTS: Array<[string, string]> = [
  ["#efe7f0", "#4f3653"], // plum
  ["#e6eef8", "#244f80"], // blue
  ["#f6ecdf", "#7d5a34"], // bronze
  ["#e7efe9", "#3f6349"], // sage
  ["#f6e6e8", "#8a4a55"], // rose
  ["#e4f0f4", "#2f6b7a"], // sky
  ["#f3efe4", "#7a6a3c"], // sand
  ["#ece8f4", "#5b4d86"], // lilac
];

function DeckArrow({
  direction,
  onClick,
  label,
}: {
  direction: "prev" | "next";
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="academy-deck-arrow"
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
        <path
          d={direction === "prev" ? "M10 4 6 8l4 4" : "M6 4l4 4-4 4"}
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}

export function AcademySpecialtyCarousel({
  hideHeading = false,
}: {
  hideHeading?: boolean;
}) {
  const [active, setActive] = useState(0);
  const trackRef = useRef<HTMLDivElement>(null);
  const scrollDriven = useRef(false);

  /** Scroll range (px) the track covers beyond the sticky viewport. */
  const scrollRange = useCallback(() => {
    const track = trackRef.current;
    if (!track) return 0;
    return Math.max(1, track.offsetHeight - window.innerHeight);
  }, []);

  /** Scroll the window so that card `index` is the front card. */
  const goTo = useCallback(
    (index: number) => {
      const track = trackRef.current;
      const i = (index + COUNT) % COUNT;
      if (!track || !scrollDriven.current) {
        setActive(i);
        return;
      }
      const top = track.getBoundingClientRect().top + window.scrollY;
      const target = top + ((i + 0.5) / COUNT) * scrollRange();
      window.scrollTo({ top: target, behavior: "smooth" });
    },
    [scrollRange],
  );

  const next = useCallback(() => goTo(active + 1), [goTo, active]);
  const prev = useCallback(() => goTo(active - 1), [goTo, active]);

  // Scroll-driven deck: progress through the tall track selects the front card.
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;
    scrollDriven.current = true;
    track.classList.add("academy-deck-track--scroll");

    const layout = track.querySelector<HTMLElement>(".academy-deck-layout");
    const measure = () => {
      if (layout) track.style.setProperty("--deck-h", `${layout.offsetHeight}px`);
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (layout) ro.observe(layout);

    let frame = 0;
    const update = () => {
      frame = 0;
      const rect = track.getBoundingClientRect();
      const progress = Math.min(1, Math.max(0, -rect.top / scrollRange()));
      const index = Math.min(COUNT - 1, Math.floor(progress * COUNT));
      setActive((current) => (current === index ? current : index));
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      cancelAnimationFrame(frame);
      ro.disconnect();
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [scrollRange]);

  // Keyboard navigation when the deck has focus.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target?.closest?.(".academy-deck")) return;
      if (event.key === "ArrowRight") next();
      if (event.key === "ArrowLeft") prev();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, prev]);

  return (
    <div className="notion-academy py-4 sm:py-6">
      <div className="notion-page notion-page--wide px-0">
        {!hideHeading && (
          <div className="mb-10 grid gap-6 lg:mb-12 lg:grid-cols-[1.05fr_0.95fr] lg:items-end lg:gap-10">
            <div>
              <p className="eyebrow mb-3">Academy</p>
              <h2 className="max-w-[520px] text-[clamp(26px,3vw+14px,38px)] font-bold leading-[1.12] tracking-[-0.8px] text-pa-ink">
                Every specialist is credentialed, not just contracted.
              </h2>
            </div>
            <p className="max-w-[480px] text-[15px] leading-[1.65] text-pa-muted lg:pb-1">
              The Certified Private Attaché credential is the foundation. Eight
              Specialty Endorsements build on it — each with learning, applied
              work, and a proctored assessment before Whitby assigns live
              engagements.
            </p>
          </div>
        )}

        <div
          ref={trackRef}
          className="academy-deck-track"
          style={{ "--deck-count": COUNT } as React.CSSProperties}
        >
        <div className="academy-deck-layout">
          {/* Specialty index */}
          <ol className="academy-deck-list" aria-label="Specialty endorsements">
            {DECK_PROGRAMS.map((program, i) => {
              const [bg, accent] = CARD_TINTS[i % CARD_TINTS.length];
              const isActive = i === active;
              return (
                <li key={program.title}>
                  <button
                    type="button"
                    onClick={() => goTo(i)}
                    aria-current={isActive ? "true" : undefined}
                    className={cn(
                      "academy-deck-list-item",
                      isActive && "academy-deck-list-item--active",
                    )}
                    style={
                      {
                        "--tint": bg,
                        "--tint-accent": accent,
                      } as React.CSSProperties
                    }
                  >
                    <span className="academy-deck-list-dot" />
                    <span className="academy-deck-list-title">{program.title}</span>
                    <span className="academy-deck-list-n">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>

          {/* Stacked deck */}
          <div className="academy-deck" tabIndex={0} aria-roledescription="carousel">
            <div className="academy-deck-stack">
              {DECK_PROGRAMS.map((program, i) => {
                const offset = (i - active + COUNT) % COUNT;
                const [bg, accent] = CARD_TINTS[i % CARD_TINTS.length];
                const hidden = offset > VISIBLE_BEHIND;
                return (
                  <article
                    key={program.title}
                    aria-hidden={offset !== 0}
                    onClick={offset === 0 ? undefined : () => goTo(i)}
                    className={cn(
                      "academy-deck-card",
                      offset === 0 && "academy-deck-card--front",
                      hidden && "academy-deck-card--hidden",
                    )}
                    style={
                      {
                        "--offset": offset,
                        "--tint": bg,
                        "--tint-accent": accent,
                        zIndex: COUNT - offset,
                      } as React.CSSProperties
                    }
                  >
                    <div className="academy-deck-card-visual">
                      <SpecialtyPreviewScene icon={program.icon} />
                    </div>
                    <div className="academy-deck-card-body">
                      <span className="academy-deck-card-n">
                        Specialty {String(i + 1).padStart(2, "0")} / {String(COUNT).padStart(2, "0")}
                      </span>
                      <h3 className="academy-deck-card-title">{program.title}</h3>
                      <p className="academy-deck-card-desc">{program.desc}</p>
                      {offset === 0 && (
                        <Link href={moduleHref("academy")} className="academy-deck-card-link">
                          Learn more
                          <IconArrow size={14} />
                        </Link>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>

            <div className="academy-deck-controls">
              <DeckArrow direction="prev" label="Previous specialty" onClick={prev} />
              <span className="academy-deck-counter">
                {String(active + 1).padStart(2, "0")}
                <span className="academy-deck-counter-sep">/</span>
                {String(COUNT).padStart(2, "0")}
              </span>
              <DeckArrow direction="next" label="Next specialty" onClick={next} />
            </div>
          </div>
        </div>
        </div>
      </div>
    </div>
  );
}
