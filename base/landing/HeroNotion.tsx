"use client";

import { Monogram } from "@/base/landing/brand/Monogram";
import { MODULE_ICONS, MODULE_TAB_META } from "@/base/landing/brand/Icons";
import { WhitbyWord } from "@/base/landing/WhitbyWord";
import { IconSend, IconWhitby } from "@/base/landing/brand/Icons";
import {
  BUILD_STEPS,
  HERO_CHIP_PROMPTS,
  HERO_PLAN_PREVIEW,
  HERO_TRY_ASKING,
  MODULES,
  type ModuleKey,
} from "@/base/landing/content";
import { cn } from "@/base/lib/cn";
import { NotionHeroAside } from "@/base/landing/NotionHeroAside";
import { NotionReveal } from "@/base/landing/NotionReveal";
import type { HeroComposerProps } from "@/base/landing/HeroTripadvisor";

const STARTERS = [
  { key: "Relocation", prompt: "Plan a relocation to Geneva for a family of four" },
  { key: "Board packet", prompt: "Q3 family office board packet" },
  { key: "Residence opening", prompt: "Open the Aspen residence for winter" },
] as const;

export function HeroNotion({
  heroDraft,
  setHeroDraft,
  heroPhase,
  buildStep,
  submitHero,
  openAssistant,
  onReadySignup,
  setHeroPhase,
  activeModule = "whitby",
  onSelectModule,
}: HeroComposerProps) {
  return (
    <section id="section-whitby" className="notion-hero">
      <div className="notion-page notion-page--wide">
        <NotionReveal>
        <div className="notion-hero-grid">
          <div className="notion-hero-main">
            <p className="notion-label">Private Attaché</p>
            <h1 className="notion-hero-title">
              Build a plan with <WhitbyWord staticMark />
            </h1>
            <p className="notion-hero-lede">
              Bring a relocation, a board packet, or a residence opening. Whitby
              drafts the plan and runs it with you.
            </p>

            <div
              className="notion-module-tabs"
              role="tablist"
              aria-label="Product modules"
            >
              {MODULES.map((module) => {
                const active = activeModule === module.key;
                const Icon = MODULE_ICONS[module.key];
                const meta = MODULE_TAB_META[module.key];
                return (
                  <button
                    key={module.key}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => onSelectModule?.(module.key as ModuleKey)}
                    className={cn(
                      "notion-module-tab",
                      active && "notion-module-tab--active",
                    )}
                  >
                    <Icon size={16} />
                    <span>{meta.label}</span>
                  </button>
                );
              })}
            </div>

            <div className="notion-search">
              {heroPhase === "idle" && (
                <>
                  <div className="notion-search-row">
                    <input
                      type="text"
                      value={heroDraft}
                      onChange={(e) => setHeroDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") submitHero();
                      }}
                      placeholder="Plan a relocation to Geneva for a family of four"
                      className="notion-search-input"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        openAssistant(
                          heroDraft.trim() ||
                            "Plan a relocation to Geneva for a family of four",
                        )
                      }
                      className="notion-btn notion-btn--secondary"
                    >
                      <IconWhitby size={14} />
                      Ask Whitby
                    </button>
                    <button
                      type="button"
                      onClick={submitHero}
                      className="notion-btn notion-btn--primary"
                    >
                      Draft
                      <IconSend size={14} className="rotate-90" />
                    </button>
                  </div>

                  <div className="notion-divider" />

                  <p className="notion-sublabel">Popular starting points</p>
                  <ul className="notion-list">
                    {STARTERS.map((item) => (
                      <li key={item.key}>
                        <button
                          type="button"
                          className="notion-list-row"
                          onClick={() =>
                            openAssistant(HERO_CHIP_PROMPTS[item.key] ?? item.prompt)
                          }
                        >
                          <span className="notion-list-title">{item.key}</span>
                          <span className="notion-list-meta">{item.prompt}</span>
                        </button>
                      </li>
                    ))}
                  </ul>

                  <div className="notion-chips">
                    <span className="notion-sublabel">Try asking</span>
                    {HERO_TRY_ASKING.map((prompt) => (
                      <button
                        key={prompt}
                        type="button"
                        className="notion-chip"
                        onClick={() =>
                          openAssistant(HERO_CHIP_PROMPTS[prompt] ?? prompt)
                        }
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                </>
              )}

              {heroPhase !== "idle" && (
                <div className="notion-plan-blur" aria-hidden>
                  {HERO_PLAN_PREVIEW.map((item) => (
                    <div key={item.title} className="notion-plan-row">
                      <span>{item.title}</span>
                    </div>
                  ))}
                </div>
              )}

              {heroPhase === "building" && (
                <div className="notion-overlay">
                  <p className="notion-overlay-title">Drafting your work plan</p>
                  <ul className="notion-steps">
                    {BUILD_STEPS.map((label, index) => {
                      const done = buildStep > index;
                      const active = buildStep === index;
                      return (
                        <li
                          key={label}
                          className={cn(
                            "notion-step",
                            done && "notion-step--done",
                            active && "notion-step--active",
                          )}
                        >
                          {label}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}

              {heroPhase === "ready" && (
                <div className="notion-overlay notion-overlay--center">
                  <Monogram size={24} variant="ink" />
                  <p className="notion-overlay-title">Your plan is ready.</p>
                  <button
                    type="button"
                    className="notion-btn notion-btn--primary"
                    onClick={() => {
                      setHeroPhase("idle");
                      onReadySignup();
                    }}
                  >
                    Create an account to open your plan
                  </button>
                </div>
              )}
            </div>
          </div>

          <NotionHeroAside />
        </div>
        </NotionReveal>
      </div>
    </section>
  );
}
