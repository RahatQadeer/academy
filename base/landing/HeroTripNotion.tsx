"use client";

import { useEffect, useRef, useState } from "react";
import { Monogram } from "@/base/landing/brand/Monogram";
import {
  OrbitBoatMark,
  OrbitPlaneMark,
  TRIP_ROUTE_BOAT,
  TRIP_ROUTE_PLANE,
} from "@/base/landing/HeroOrbitCrafts";
import { WhitbyWord } from "@/base/landing/WhitbyWord";
import {
  IconArrow,
  IconCheck,
  IconDocument,
  IconPartner,
  IconPortal,
  IconSend,
  IconWhitby,
} from "@/base/landing/brand/Icons";
import {
  BUILD_STEPS,
  HERO_CHIP_PROMPTS,
  HERO_PLAN_PREVIEW,
  HERO_TRY_ASKING,
} from "@/base/landing/content";
import { cn } from "@/base/lib/cn";
import type { HeroComposerProps } from "@/base/landing/HeroTripadvisor";

const ROTATING_PROMPTS = [
  "Plan a relocation to Geneva for a family of four",
  "Draft the Q3 family office board packet",
  "Open the Aspen residence for the winter season",
  "Renew every household passport before June",
];

const BRENT_ROTATING_PROMPTS = [
  "Plan a relocation to Geneva for a family of four",
  "Coordinate a three-day executive retreat in Miami",
  "Organize a client project with multiple deadlines and approvals",
  "Prepare for a family meeting with advisers and key decisions",
  "Coordinate schools, applications, testing and deadlines",
  "Get a seasonal residence ready before the family arrives",
  "Plan a private event for 40 guests next month",
];

const BRENT_INTERESTS = [
  {
    key: "Relocate",
    title: "Relocate or move",
    eyebrow: "Housing, timelines and key decisions",
    example: "",
    prompt: "Plan a relocation to Geneva for a family of four",
    accent: "sky",
    Icon: IconWhitby,
  },
  {
    key: "Plan an event",
    title: "Plan an event",
    eyebrow: "Venue, guests, schedules and vendors",
    example: "",
    prompt: "Plan a private event for 40 guests next month",
    accent: "rose",
    Icon: IconPortal,
  },
  {
    key: "Coordinate client work",
    title: "Coordinate client work",
    eyebrow: "Tasks, deadlines, people and next steps",
    example: "",
    prompt: "Organize a client project with multiple deadlines and approvals",
    accent: "sage",
    Icon: IconDocument,
  },
  {
    key: "Manage family matters",
    title: "Manage family matters",
    eyebrow: "People, advisers, responsibilities and follow-up",
    example: "",
    prompt: "Prepare for a family meeting with advisers and key decisions",
    accent: "plum",
    Icon: IconPartner,
  },
] as const;

const INTERESTS = [
  {
    key: "Relocation",
    eyebrow: "Global mobility",
    title: "Relocation",
    example: "Zurich to Austin · family of four",
    prompt: "Plan a Zurich → Austin relocation",
    Icon: IconWhitby,
  },
  {
    key: "Board packet",
    eyebrow: "Governance",
    title: "Board packet",
    example: "Q3 family office board",
    prompt: "Draft a Q3 board packet",
    Icon: IconDocument,
  },
  {
    key: "Residence opening",
    eyebrow: "Private residence",
    title: "Residence opening",
    example: "Seasonal residence · two-week open",
    prompt: "Open the Aspen residence for winter",
    Icon: IconPortal,
  },
  {
    key: "Family office",
    eyebrow: "Multi-entity",
    title: "Family office",
    example: "Board cycle and reporting calendar",
    prompt: "Coordinate a family office board cycle",
    Icon: IconPartner,
  },
] as const;

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return reduced;
}

/** Typewriter placeholder that cycles through prompts while the input is empty. */
function useTypewriter(prompts: string[], paused: boolean) {
  const [text, setText] = useState("");
  const state = useRef({ index: 0, pos: 0, deleting: false });

  useEffect(() => {
    if (paused) return;
    let timer = 0;

    const tick = () => {
      const s = state.current;
      const current = prompts[s.index];
      let delay = 38;

      if (!s.deleting) {
        s.pos += 1;
        if (s.pos >= current.length) {
          s.pos = current.length;
          s.deleting = true;
          delay = 2200;
        }
      } else {
        s.pos -= 1;
        delay = 18;
        if (s.pos <= 0) {
          s.pos = 0;
          s.deleting = false;
          s.index = (s.index + 1) % prompts.length;
          delay = 420;
        }
      }
      setText(current.slice(0, s.pos));
      timer = window.setTimeout(tick, delay);
    };

    timer = window.setTimeout(tick, 600);
    return () => window.clearTimeout(timer);
  }, [prompts, paused]);

  return text;
}

function KindPill({ kind, muted }: { kind: string; muted?: boolean }) {
  return (
    <span
      className={cn(
        "shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold tracking-[0.04em] uppercase",
        muted
          ? "bg-[#f1f1ef] text-pa-muted"
          : kind === "Approval"
            ? "bg-pa-amber text-pa-amber-ink"
            : "bg-[#e7e6e3] text-pa-ink",
      )}
    >
      {kind}
    </span>
  );
}

function HeadlineWords({ text }: { text: string }) {
  return (
    <>
      {text.split(" ").map((word, i) => (
        <span
          key={`${word}-${i}`}
          className="trip-word"
          style={{ "--w": i } as React.CSSProperties}
        >
          {word}&nbsp;
        </span>
      ))}
    </>
  );
}

/**
 * Tripadvisor-style hero (centered headline + unified composer) in the Notion
 * design language, with live product scenes floating around the composer.
 */
export function HeroTripNotion({
  heroDraft,
  setHeroDraft,
  heroPhase,
  buildStep,
  submitHero,
  openAssistant,
  onReadySignup,
  setHeroPhase,
  layout = "default",
  navSlot,
}: HeroComposerProps) {
  const giant = layout === "gigantism";
  const brent = layout === "brent";
  const prompts = brent ? BRENT_ROTATING_PROMPTS : ROTATING_PROMPTS;
  const interests = brent ? BRENT_INTERESTS : INTERESTS;
  const reduced = useReducedMotion();
  const [focused, setFocused] = useState(false);
  // Cycle suggestions whenever the field is empty — including while focused.
  const typed = useTypewriter(prompts, reduced || heroDraft.length > 0);
  const placeholder = reduced ? prompts[0] : typed;

  return (
    <section
      id="section-whitby"
      className={cn("trip-hero", giant && "trip-hero--gigantism", brent && "trip-hero--brent")}
    >
      {/* Visual identity: wash, dot grid, route arcs + travelers */}
      <div className="trip-identity" aria-hidden>
        <div className="trip-wash" />
        <div className="trip-grid" />
        <div className="trip-route-stack">
          <svg className="trip-routes" viewBox="0 0 1000 1000" fill="none">
            <path d={TRIP_ROUTE_PLANE} className="trip-route-line trip-route-line--plane" />
            <path d={TRIP_ROUTE_BOAT} className="trip-route-line trip-route-line--boat" />
            <g
              className="trip-route-craft trip-route-craft--plane"
              transform={reduced ? "translate(500 195) rotate(-8)" : undefined}
            >
              <OrbitPlaneMark />
              {!reduced && (
                <animateMotion
                  dur="42s"
                  repeatCount="indefinite"
                  rotate="auto"
                  path={TRIP_ROUTE_PLANE}
                />
              )}
            </g>
            <g
              className="trip-route-craft trip-route-craft--boat"
              transform={reduced ? "translate(680 535) rotate(12)" : undefined}
            >
              <OrbitBoatMark />
              {!reduced && (
                <animateMotion
                  dur="68s"
                  repeatCount="indefinite"
                  rotate="auto"
                  path={TRIP_ROUTE_BOAT}
                />
              )}
            </g>
          </svg>
        </div>
      </div>

      <div className="trip-stage">
        {giant && navSlot ? <div className="trip-stage-nav">{navSlot}</div> : null}
        <div className={cn(giant && "trip-stage-body")}>
        <div className="trip-content">
          {brent ? (
            <>
              <h1 className="trip-brent-headline">AI for whatever you&rsquo;re planning.</h1>
              <p className="trip-brent-sub">
                Private Attaché is the intelligent coordination platform that helps bring
                it all together.
              </p>
            </>
          ) : (
            <div className="trip-giant-copy">
              {giant ? (
                <div className="trip-giant-badge">
                  <span className="trip-giant-badge__tag">Whitby</span>
                  Private engagements, run end to end
                </div>
              ) : (
                <p className="trip-eyebrow">Private engagements, run end to end</p>
              )}

              <h1 className="trip-title">
                {giant ? (
                  <>
                    <span className="trip-title-line">Build a plan</span>
                    <span className="trip-title-line">
                      with{" "}
                      <span className="trip-word" style={{ "--w": 1 } as React.CSSProperties}>
                        <WhitbyWord staticMark />
                      </span>
                    </span>
                  </>
                ) : (
                  <>
                    <HeadlineWords text="Build a plan with" />
                    <span className="trip-word" style={{ "--w": 4 } as React.CSSProperties}>
                      <WhitbyWord staticMark />
                    </span>
                  </>
                )}
              </h1>

              <p className="trip-lede">
                Bring a relocation, a board packet, or a residence opening. Whitby
                drafts the plan and runs it with you.
              </p>
            </div>
          )}

          {brent ? (
            <p className="trip-brent-prompt">What are you planning today?</p>
          ) : null}

          <div className={cn("trip-composer-wrap", giant && "trip-giant-visual")}>
            {heroPhase === "idle" && (
              <div className="trip-panel">
                <div className="trip-panel-search">
                  <div className={cn("trip-pill", focused && "trip-pill--focused")}>
                    <span className="trip-pill-icon">
                      <IconWhitby size={16} />
                    </span>
                    <input
                      type="text"
                      value={heroDraft}
                      onChange={(event) => setHeroDraft(event.target.value)}
                      onFocus={() => setFocused(true)}
                      onBlur={() => setFocused(false)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") submitHero();
                      }}
                      placeholder={placeholder}
                      aria-label="Describe what needs to happen"
                      className="trip-input"
                    />
                    <div className="trip-pill-actions">
                      <button
                        type="button"
                        onClick={() =>
                          openAssistant(heroDraft.trim() || prompts[0])
                        }
                        className="trip-btn trip-btn--ghost"
                      >
                        Ask Whitby
                      </button>
                      <button
                        type="button"
                        onClick={submitHero}
                        className="trip-btn trip-btn--primary"
                      >
                        {brent ? "Start" : "Draft"}
                        <IconSend size={14} className="rotate-90" />
                      </button>
                    </div>
                  </div>
                </div>

                <div className="trip-panel-body">
                  <p className="trip-sublabel">Popular starting points</p>
                  <div className="trip-interests">
                    {interests.map((item, index) => {
                      const Icon = item.Icon;
                      const accent =
                        "accent" in item && item.accent
                          ? `trip-interest--${item.accent}`
                          : "";
                      return (
                        <button
                          key={item.key}
                          type="button"
                          style={{ "--i": index } as React.CSSProperties}
                          onClick={() =>
                            openAssistant(HERO_CHIP_PROMPTS[item.key] ?? item.prompt)
                          }
                          className={cn("trip-interest", accent)}
                        >
                          <span className="trip-interest-icon">
                            <Icon size={18} />
                          </span>
                          <span className="trip-interest-text">
                            <span className="trip-interest-head">
                              <span className="trip-interest-title">{item.title}</span>
                              <span className="trip-interest-eyebrow">{item.eyebrow}</span>
                            </span>
                            <span className="trip-interest-example">{item.example}</span>
                          </span>
                          <span className="trip-interest-arrow">
                            <IconArrow size={14} />
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="trip-panel-foot">
                  <span className="trip-sublabel trip-sublabel--inline">Try asking</span>
                  {HERO_TRY_ASKING.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      onClick={() => openAssistant(HERO_CHIP_PROMPTS[prompt] ?? prompt)}
                      className="trip-chip"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {heroPhase !== "idle" && (
              <div className="trip-plan-blur" aria-hidden>
                <div className="trip-plan-blur-head">
                  <Monogram size={14} variant="ink" />
                  <span>Whitby — Work Plan</span>
                </div>
                <div className="trip-plan-blur-body">
                  {HERO_PLAN_PREVIEW.map((item) => (
                    <div key={item.title} className="trip-plan-blur-row">
                      <span
                        className={cn(
                          "trip-plan-blur-dot",
                          item.done && "trip-plan-blur-dot--done",
                        )}
                      >
                        {item.done ? <IconCheck size={10} strokeWidth={3} /> : null}
                      </span>
                      <span className="flex-1">{item.title}</span>
                      <KindPill kind={item.kind} muted={item.muted} />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {heroPhase === "building" && (
              <div className="trip-overlay">
                <div className="trip-overlay-head">
                  <span className="trip-overlay-avatar">
                    <Monogram size={14} variant="signal" />
                  </span>
                  <span className="trip-overlay-title">I am drafting your work plan.</span>
                </div>
                <p className="trip-overlay-sub">This usually takes under a minute.</p>
                <ul className="trip-steps">
                  {BUILD_STEPS.map((label, index) => {
                    const done = buildStep > index;
                    const active = buildStep === index;
                    return (
                      <li
                        key={label}
                        className={cn(
                          "trip-step",
                          done && "trip-step--done",
                          active && "trip-step--active",
                        )}
                      >
                        <span className="trip-step-dot">
                          {done ? <IconCheck size={10} strokeWidth={3} /> : null}
                        </span>
                        {label}
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            {heroPhase === "ready" && (
              <div className="trip-overlay trip-overlay--center">
                <div className="trip-overlay-head">
                  <span className="trip-overlay-avatar">
                    <Monogram size={14} variant="signal" />
                  </span>
                  <span className="trip-overlay-title">Your plan is ready.</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setHeroPhase("idle");
                    onReadySignup();
                  }}
                  className="trip-btn trip-btn--primary trip-btn--lg"
                >
                  Create an account to open your plan
                </button>
              </div>
            )}
          </div>
        </div>
        </div>
      </div>
    </section>
  );
}
