"use client";

import { Monogram } from "@/base/landing/brand/Monogram";
import { WhitbyWord } from "@/base/landing/WhitbyWord";
import {
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
  type ModuleKey,
} from "@/base/landing/content";
import { cn } from "@/base/lib/cn";

export type HeroPhase = "idle" | "building" | "ready";

export type HeroComposerProps = {
  heroDraft: string;
  setHeroDraft: (value: string) => void;
  heroPhase: HeroPhase;
  buildStep: number;
  submitHero: () => void;
  openAssistant: (seed?: string) => void;
  onReadySignup: () => void;
  setHeroPhase: (phase: HeroPhase) => void;
  activeModule?: ModuleKey;
  onSelectModule?: (key: ModuleKey) => void;
  /** AgentAI-style oversized split hero */
  layout?: "default" | "gigantism" | "brent";
  /** Rendered at top of gigantism shell (e.g. inset nav) */
  navSlot?: React.ReactNode;
};

function WhitbyAvatar({ size = 18 }: { size?: number }) {
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-md bg-[var(--pa-blue)]"
      style={{ width: size + 12, height: size + 12 }}
    >
      <Monogram size={size} variant="signal" />
    </span>
  );
}

function KindPill({ kind, muted }: { kind: string; muted?: boolean }) {
  return (
    <span
      className={cn(
        "shrink-0 rounded-md px-1.5 py-0.5 text-[12px] font-bold tracking-[0.04em] uppercase",
        muted
          ? "bg-pa-cream text-pa-muted"
          : kind === "Approval"
            ? "bg-pa-amber text-pa-amber-ink"
            : "bg-pa-mauve text-pa-blue-dark",
      )}
    >
      {kind}
    </span>
  );
}

const INTERESTS = [
  {
    key: "Relocation",
    eyebrow: "Global mobility",
    title: "Relocation",
    body: "Schools, shipping, and tax residency in one work plan.",
    example: "Zurich to Austin · family of four",
    Icon: IconWhitby,
  },
  {
    key: "Board packet",
    eyebrow: "Governance",
    title: "Board packet",
    body: "Agenda, materials, and approvers scoped for the principal.",
    example: "Q3 family office board",
    Icon: IconDocument,
  },
  {
    key: "Residence opening",
    eyebrow: "Private residence",
    title: "Residence opening",
    body: "Staffing, vendors, and opening day on a single timeline.",
    example: "Seasonal residence · two-week open",
    Icon: IconPortal,
  },
  {
    key: "Family office",
    eyebrow: "Multi-entity",
    title: "Family office",
    body: "One coordination layer across entities and engagements.",
    example: "Board cycle and reporting calendar",
    Icon: IconPartner,
  },
] as const;

function InterestRow({
  item,
  index,
  onOpen,
}: {
  item: (typeof INTERESTS)[number];
  index: number;
  onOpen: () => void;
}) {
  const Icon = item.Icon;
  return (
    <button
      type="button"
      style={{ "--trip-delay": `${0.04 + index * 0.05}s` } as React.CSSProperties}
      onClick={onOpen}
      className="hero-trip-interest group flex w-full items-center gap-3 rounded-lg border border-pa-line/70 bg-white px-3 py-3.5 text-left transition duration-200 hover:border-pa-ink/25 hover:bg-pa-panel focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--pa-blue)] sm:px-4"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-pa-line bg-pa-panel text-pa-blue transition-colors duration-200 group-hover:border-pa-blue/20 group-hover:bg-pa-soft">
        <Icon size={18} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="text-[14px] font-semibold tracking-[-0.15px] text-pa-ink">
            {item.title}
          </span>
          <span className="text-[11px] font-bold tracking-[0.08em] text-pa-muted uppercase">
            {item.eyebrow}
          </span>
        </span>
        <span className="mt-0.5 block truncate text-[12px] text-pa-muted sm:whitespace-normal sm:overflow-visible">
          {item.example}
        </span>
      </span>
    </button>
  );
}

/** Tripadvisor-inspired: centered headline + unified composer panel (search, starting points). */
export function HeroTripadvisor({
  heroDraft,
  setHeroDraft,
  heroPhase,
  buildStep,
  submitHero,
  openAssistant,
  onReadySignup,
  setHeroPhase,
}: HeroComposerProps) {
  return (
    <section
      id="section-whitby"
      className="relative z-10 flex flex-1 flex-col items-center justify-center px-5 pb-16 pt-6 text-center sm:px-8 sm:pb-20 sm:pt-8"
    >
      <div className="mx-auto w-full max-w-[920px]">
        <p className="mb-3 text-[12px] font-bold tracking-[0.12em] text-pa-muted uppercase">
          Private engagements, run end to end
        </p>

        <h1 className="mb-4 text-[clamp(36px,5.2vw+14px,56px)] font-bold leading-[1.05] tracking-[-1.8px]">
          Build a plan with <WhitbyWord staticMark />
        </h1>

        <p className="mx-auto mb-8 max-w-[540px] text-[16px] leading-relaxed text-pa-muted">
          Bring a relocation, a board packet, or a residence opening. Whitby
          drafts the plan and runs it with you.
        </p>

        <div className="relative mx-auto w-full max-w-[760px]">
          {heroPhase === "idle" && (
            <>
              <div className="hero-trip-panel overflow-hidden rounded-3xl border border-pa-line bg-white/95 text-left shadow-[0_14px_44px_rgba(23,24,26,.08)] backdrop-blur-sm">
                <div className="border-b border-pa-line p-3 sm:p-4">
                  <div className="flex flex-col gap-2 rounded-2xl border border-pa-line bg-pa-panel/50 p-2 transition-[border-color] duration-200 focus-within:border-[var(--pa-blue)] sm:flex-row sm:items-center sm:rounded-full sm:p-1.5 sm:pl-5">
                    <input
                      type="text"
                      value={heroDraft}
                      onChange={(event) => setHeroDraft(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") submitHero();
                      }}
                      placeholder="Plan a relocation to Geneva for a family of four"
                      className="min-w-0 flex-1 bg-transparent px-3 py-3 font-sans text-[15px] text-pa-ink outline-none focus-visible:outline-none sm:px-1 sm:py-2.5 placeholder:text-pa-muted"
                    />
                    <div className="flex shrink-0 gap-1.5 px-1 pb-1 sm:px-0 sm:pb-0">
                      <button
                        type="button"
                        onClick={() =>
                          openAssistant(
                            heroDraft.trim() ||
                              "Plan a relocation to Geneva for a family of four",
                          )
                        }
                        className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-full border border-pa-line bg-white px-4 py-2.5 text-[13px] font-semibold text-pa-ink transition-colors duration-200 hover:border-pa-blue sm:flex-none"
                      >
                        <IconWhitby size={14} className="text-pa-blue" />
                        Ask Whitby
                      </button>
                      <button
                        type="button"
                        onClick={submitHero}
                        className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-full bg-pa-ink px-5 py-2.5 text-[13.5px] font-bold text-white transition-colors duration-200 hover:bg-black sm:flex-none"
                      >
                        Draft
                        <IconSend size={14} className="rotate-90" />
                      </button>
                    </div>
                  </div>
                </div>

                <div className="bg-pa-panel/35 px-2 py-3 sm:px-3 sm:py-4">
                  <p className="px-2 pb-2 text-[12px] font-bold tracking-[0.08em] text-pa-muted uppercase sm:px-1">
                    Popular starting points
                  </p>
                  <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                    {INTERESTS.map((item, index) => (
                      <InterestRow
                        key={item.key}
                        item={item}
                        index={index}
                        onOpen={() =>
                          openAssistant(
                            HERO_CHIP_PROMPTS[item.key] ??
                              (item.key === "Family office"
                                ? "Coordinate a family office board cycle"
                                : item.key === "Residence opening"
                                  ? "Open the Aspen residence for winter"
                                  : item.key),
                          )
                        }
                      />
                    ))}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 border-t border-pa-line px-4 py-3 sm:px-5">
                  <span className="text-[12px] font-bold tracking-[0.06em] text-pa-muted uppercase">
                    Try asking
                  </span>
                  {HERO_TRY_ASKING.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      onClick={() =>
                        openAssistant(HERO_CHIP_PROMPTS[prompt] ?? prompt)
                      }
                      className="rounded-md border border-pa-line bg-white px-2.5 py-1 text-[12px] font-medium text-pa-ink transition-colors duration-200 hover:border-pa-ink"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {heroPhase !== "idle" && (
            <div className="pointer-events-none overflow-hidden rounded-2xl border border-pa-line bg-white text-left blur-[7px] select-none">
              <div className="flex h-[42px] items-center gap-2 border-b border-pa-line bg-pa-panel px-4">
                <Monogram size={14} variant="ink" />
                <span className="text-[13px] font-semibold text-pa-muted">
                  Whitby — Work Plan
                </span>
              </div>
              <div className="flex flex-col gap-1.5 px-4 py-4">
                {HERO_PLAN_PREVIEW.map((item) => (
                  <div
                    key={item.title}
                    className="flex items-center gap-2.5 rounded-lg px-2 py-1.5"
                  >
                    <span
                      className={cn(
                        "flex h-4 w-4 shrink-0 items-center justify-center rounded-full",
                        item.done ? "bg-pa-blue text-white" : "bg-pa-cream",
                      )}
                    >
                      {item.done ? (
                        <IconCheck size={10} strokeWidth={3} />
                      ) : null}
                    </span>
                    <span className="flex-1 text-[13px] font-medium">
                      {item.title}
                    </span>
                    <KindPill kind={item.kind} muted={item.muted} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {heroPhase === "building" && (
            <div className="overlay-pop absolute top-1/2 left-1/2 z-[5] w-[88%] max-w-[380px] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-pa-line bg-white px-6 py-5 text-left shadow-[0_20px_50px_rgba(23,24,26,.18)]">
              <div className="flex items-center gap-2.5">
                <WhitbyAvatar size={16} />
                <span className="text-[15px] font-semibold">
                  I am drafting your work plan.
                </span>
              </div>
              <div className="mt-1 mb-4 ml-[38px] text-[13px] text-pa-muted">
                This usually takes under a minute.
              </div>
              <div className="ml-[38px] flex flex-col gap-2">
                {BUILD_STEPS.map((label, index) => {
                  const done = buildStep > index;
                  const active = buildStep === index;
                  return (
                    <div key={label} className="flex items-center gap-2.5">
                      {done ? (
                        <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-pa-blue text-white">
                          <IconCheck size={10} strokeWidth={3} />
                        </span>
                      ) : (
                        <span
                          className={cn(
                            "h-4 w-4 shrink-0 rounded-full border-2",
                            active ? "border-pa-blue" : "border-pa-line",
                          )}
                        />
                      )}
                      <span
                        className={cn(
                          "text-[13px]",
                          done || active ? "text-pa-ink" : "text-pa-muted",
                        )}
                      >
                        {label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {heroPhase === "ready" && (
            <div className="overlay-pop absolute top-1/2 left-1/2 z-[5] -translate-x-1/2 -translate-y-1/2 text-center">
              <div className="rounded-2xl border border-pa-line bg-white px-6 py-5 shadow-[0_20px_50px_rgba(23,24,26,.18)]">
                <div className="mb-3 flex items-center justify-center gap-2.5">
                  <WhitbyAvatar size={16} />
                  <span className="text-[15px] font-semibold">
                    Your plan is ready.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setHeroPhase("idle");
                    onReadySignup();
                  }}
                  className="rounded-lg bg-pa-ink px-[22px] py-3 text-[14px] font-bold whitespace-nowrap text-white transition-colors duration-200 hover:bg-black"
                >
                  Create an account to open your plan
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
