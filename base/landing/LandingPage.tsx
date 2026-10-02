"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  COORDINATION_STEPS,
  PRINCIPLE_BAND,
  REFERRAL_STAGES,
  VA_CAPABILITIES,
  VA_CHOICES,
  chatReply,
} from "@/base/landing/content";
import { LANDING_AUTH } from "@/base/landing/auth";
import { NAV_LINKS } from "@/base/landing/nav";
import { cn } from "@/base/lib/cn";
import { AcademySpecialtyCarousel } from "@/base/landing/AcademySpecialtyCarousel";
import { SectionPhoto } from "@/base/landing/SectionPhoto";
import { HeroTripNotion } from "@/base/landing/HeroTripNotion";
import { NotionHeading, NotionSection } from "@/base/landing/NotionSection";
import { NotionStagger } from "@/base/landing/NotionReveal";
import { NotionModuleGrid } from "@/base/landing/NotionModuleGrid";
import { NotionBeforeAfter } from "@/base/landing/NotionBeforeAfter";
import { NotionFinalCta } from "@/base/landing/NotionFinalCta";
import {
  CredentialScene,
  FlowScene,
  PipelineScene,
  PortalScene,
  VaPickerScene,
} from "@/base/landing/NotionScenes";
import { BrandMark } from "@/base/landing/brand/Monogram";
import { LiquidGlassFilter } from "@/base/landing/brand/LiquidGlassFilter";
import {
  IconApproved,
  IconArrow,
  IconCheck,
  IconMessage,
  IconWhitby,
} from "@/base/landing/brand/Icons";
import { WhitbyAssistant } from "@/base/landing/WhitbyAssistant";
import { SiteNav } from "@/base/landing/SiteNav";
import { SignupModal } from "@/base/landing/SignupModal";
import "@/base/landing/styles/landing.css";

const COORDINATION_STEP_ICONS = {
  message: IconMessage,
  approved: IconApproved,
  whitby: IconWhitby,
} as const;

type HeroPhase = "idle" | "building" | "ready";
type ChatMessage = { from: "user" | "bot"; text: string };

function scrollToId(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

export function LandingPage() {
  const router = useRouter();
  const [heroDraft, setHeroDraft] = useState("");
  const [heroPhase, setHeroPhase] = useState<HeroPhase>("idle");
  const [buildStep, setBuildStep] = useState(0);
  const [showSignup, setShowSignup] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const buildInterval = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (buildInterval.current) window.clearInterval(buildInterval.current);
    };
  }, []);

  useEffect(() => {
    if ("scrollRestoration" in history) {
      history.scrollRestoration = "manual";
    }
    const nav = performance.getEntriesByType(
      "navigation",
    )[0] as PerformanceNavigationTiming | undefined;
    if (nav?.type === "reload") {
      if (window.location.hash) {
        history.replaceState(null, "", window.location.pathname + window.location.search);
      }
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    } else if (!window.location.hash) {
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    }
  }, []);

  function submitHero() {
    if (!heroDraft.trim()) return;
    if (buildInterval.current) window.clearInterval(buildInterval.current);
    setHeroPhase("building");
    setBuildStep(0);
    let step = 0;
    buildInterval.current = window.setInterval(() => {
      step += 1;
      if (step >= 5) {
        if (buildInterval.current) window.clearInterval(buildInterval.current);
        setBuildStep(5);
        setHeroPhase("ready");
      } else {
        setBuildStep(step);
      }
    }, 550);
  }

  function appendChat(question: string) {
    const reply = chatReply(question);
    setChatMessages((messages) => [
      ...messages,
      { from: "user", text: question },
      { from: "bot", text: reply },
    ]);
  }

  function openAssistant(seed?: string) {
    setChatOpen(true);
    if (seed?.trim()) {
      const value = seed.trim();
      setChatInput("");
      setChatMessages([
        { from: "user", text: value },
        { from: "bot", text: chatReply(value) },
      ]);
    }
  }

  function sendAssistant(text?: string) {
    const value = (text ?? chatInput).trim();
    if (!value) return;
    setChatInput("");
    appendChat(value);
  }

  function resetAssistant() {
    setChatMessages([]);
    setChatInput("");
  }

  return (
    <div
      data-theme="notion"
      className={cn(
        "pa-landing-root notion-doc notion-doc--brent min-h-screen w-full max-w-[100vw] overflow-x-clip bg-pa-bg text-pa-ink transition-[padding] duration-300 ease-out",
        chatOpen && "md:pl-[420px]",
      )}
    >
      <LiquidGlassFilter />
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>
      <WhitbyAssistant
        open={chatOpen}
        onClose={() => setChatOpen(false)}
        onNewChat={resetAssistant}
        input={chatInput}
        onInputChange={setChatInput}
        onSend={sendAssistant}
        messages={chatMessages}
      />

      <SiteNav
        chatOpen={chatOpen}
        onOpenAssistant={() => openAssistant()}
        onOpenSignup={() => setShowSignup(true)}
        onSelectModule={(key) => {
          router.push(`/modules/${key}`);
        }}
      />

      <div className="notion-hero-band">
          <HeroTripNotion
            layout="brent"
            heroDraft={heroDraft}
            setHeroDraft={setHeroDraft}
            heroPhase={heroPhase}
            buildStep={buildStep}
            submitHero={submitHero}
            openAssistant={openAssistant}
            onReadySignup={() => setShowSignup(true)}
            setHeroPhase={setHeroPhase}
          />

        <NotionSection id="main-content" wide className="notion-section--flush">
          <NotionHeading
            label="The platform"
            title="One coordination layer. Four surfaces."
            lede="Whitby plans and runs the work. The portal, the academy and the partner network sit around it."
          />
          <NotionModuleGrid />
        </NotionSection>
      </div>

      <NotionSection>
        <NotionHeading
          label="How coordination works"
          title="Request in. Plan out. A person approves."
          lede="Describe what needs to happen. Whitby drafts the work, runs the routine parts, and routes anything sensitive to a named approver."
        />
        <div className="mb-8">
          <FlowScene />
        </div>
        <NotionStagger className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {COORDINATION_STEPS.map((step) => {
            const StepIcon = COORDINATION_STEP_ICONS[step.icon];
            return (
              <div
                key={step.n}
                className="notion-block notion-block--live"
              >
                <div className="mb-3 flex items-center gap-2.5">
                  <StepIcon size={20} className="text-pa-blue" />
                  <span className="text-xs font-bold text-pa-blue">{step.n}</span>
                </div>
                <div className="mb-1.5 text-sm font-semibold">{step.title}</div>
                <div className="text-[12.5px] leading-normal text-pa-muted">{step.body}</div>
              </div>
            );
          })}
        </NotionStagger>
      </NotionSection>

      <NotionSection id="section-va" wide>
        <div className="mb-8 grid grid-cols-1 items-end gap-6 lg:grid-cols-[1.15fr_1fr] lg:gap-12">
          <div>
            <NotionHeading
              label="Virtual assistants"
              title="Choose a VA to build and execute your plan."
              lede="Whitby drafts the work. You pick the credentialed VA who owns the build, runs the routine steps, and stays on the engagement with you."
            />
          </div>
          <div className="flex flex-col gap-3 lg:pb-1">
            <NotionStagger className="flex flex-col gap-2.5">
              {VA_CAPABILITIES.map((item) => (
                <div key={item.title} className="flex items-start gap-2.5 text-[13.5px]">
                  <IconCheck size={16} className="mt-0.5 shrink-0 text-pa-blue-dark" />
                  <div>
                    <div className="font-semibold text-pa-ink">{item.title}</div>
                    <div className="text-[12.5px] leading-normal text-pa-muted">{item.body}</div>
                  </div>
                </div>
              ))}
            </NotionStagger>
            <div className="mt-1 flex flex-wrap gap-2.5">
              <button
                type="button"
                className="inline-flex items-center gap-1.5 rounded-full bg-pa-ink px-4 py-2 text-[13px] font-semibold text-white transition-transform duration-200 hover:-translate-y-px"
                onClick={() => setShowSignup(true)}
              >
                Get started
                <IconArrow size={14} />
              </button>
              <Link
                href="/modules/whitby"
                className="inline-flex items-center rounded-full border border-pa-line bg-white px-4 py-2 text-[13px] font-semibold text-pa-ink no-underline transition-colors duration-200 hover:bg-pa-panel"
              >
                Explore Whitby
              </Link>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(280px,360px)] lg:gap-8">
          <NotionStagger className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {VA_CHOICES.map((va) => (
              <div
                key={va.id}
                className={cn(
                  "notion-block notion-block--live",
                  va.selected && "border-pa-blue bg-pa-soft",
                )}
              >
                <div className="mb-3 flex items-center gap-2.5">
                  <span
                    className={cn(
                      "inline-flex h-9 w-9 items-center justify-center rounded-full text-[11px] font-bold text-white",
                      va.selected ? "bg-pa-blue" : "bg-pa-deep",
                    )}
                  >
                    {va.initials}
                  </span>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold">{va.name}</div>
                    <div className="truncate text-[11.5px] text-pa-muted">{va.specialty}</div>
                  </div>
                </div>
                <p className="mb-3 text-[12.5px] leading-normal text-pa-muted">{va.focus}</p>
                <span
                  className={cn(
                    "inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold",
                    va.selected
                      ? "bg-pa-blue text-white"
                      : "border border-pa-line text-pa-muted",
                  )}
                >
                  {va.selected ? "Selected for this plan" : "Available"}
                </span>
              </div>
            ))}
          </NotionStagger>
          <VaPickerScene />
        </div>
      </NotionSection>

      <NotionSection id="security" wide>
        <div className="notion-photo-band">
          <div className="notion-photo-band__media" aria-hidden>
            <SectionPhoto image="principles" fill sizes="100vw" />
          </div>
          <div className="notion-photo-band__content">
            <p className="notion-photo-band__label">How we work</p>
            <h2 className="notion-photo-band__title">Discreet, human, credentialed</h2>
            <NotionStagger className="notion-photo-band__grid">
              {PRINCIPLE_BAND.map((item) => (
                <div key={item.title} className="notion-photo-band__card">
                  <h3>{item.title}</h3>
                  <p>{item.body}</p>
                </div>
              ))}
            </NotionStagger>
          </div>
        </div>
      </NotionSection>

      <NotionSection id="section-portal" wide>
        <div className="mb-8 grid grid-cols-1 items-end gap-6 lg:grid-cols-[1.2fr_1fr] lg:gap-12">
          <div>
            <NotionHeading
              label="Client Portal"
              title="What the principal sees, without the noise."
            />
            <p className="notion-lede">
              Client Portal gives principals a live view of status, shared documents,
              and next steps — scoped so internal workplans, notes, and provider
              research never surface.
            </p>
          </div>
          <div className="flex flex-col gap-2.5 text-[13.5px] text-pa-ink/70 lg:pb-1">
            {[
              "Real-time status on every open request",
              "Shared documents, without email attachments",
              "A direct line to the professional on the engagement",
            ].map((item) => (
              <div key={item} className="flex items-start gap-2.5">
                <IconCheck size={16} className="mt-0.5 shrink-0 text-pa-blue-dark" />
                {item}
              </div>
            ))}
          </div>
        </div>
        <div className="notion-composite notion-composite--mirror notion-composite--right">
          <SectionPhoto
            image="yacht"
            variant="panel"
            className="notion-composite__photo"
            sizes="(max-width: 1100px) 100vw, 1100px"
          />
          <PortalScene className="notion-composite__scene" />
        </div>
      </NotionSection>

      <NotionSection id="section-academy" wide>
        <div className="mb-8 grid grid-cols-1 items-center gap-8 lg:grid-cols-[1fr_360px]">
          <NotionHeading
            label="Academy"
            title="Every specialist is credentialed, not just contracted."
            lede="Learning, applied work, and a proctored assessment — before Whitby assigns a live engagement."
          />
          <CredentialScene />
        </div>
        <AcademySpecialtyCarousel hideHeading />
      </NotionSection>

      <NotionSection id="section-partner" wide>
          <div className="mb-10 grid grid-cols-1 items-center gap-8 lg:grid-cols-2">
            <div>
              <NotionHeading
                label="Partner Center"
                title="Refer once, earn on every conversion."
                lede="Submit a referral, track it to conversion, and get paid on a fixed schedule — with a protection window so a submitted opportunity stays yours while it&apos;s worked."
              />
            </div>
            <PipelineScene />
          </div>
          <NotionStagger className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {REFERRAL_STAGES.map((stage) => (
              <div
                key={stage.n}
                className="notion-block notion-block--live"
              >
                <div className="mb-3 flex h-[26px] w-[26px] items-center justify-center rounded bg-pa-blue text-xs font-bold text-white">
                  {stage.n}
                </div>
                <div className="mb-1.5 text-[13.5px] font-bold">{stage.title}</div>
                <div className="text-xs leading-normal text-pa-muted">{stage.body}</div>
              </div>
            ))}
          </NotionStagger>
      </NotionSection>

      <NotionBeforeAfter />

      <NotionSection id="pricing" wide>
        <NotionFinalCta
          onPrimary={() => setShowSignup(true)}
          onSecondary={() => setShowSignup(true)}
        />
      </NotionSection>

      <SignupModal open={showSignup} onClose={() => setShowSignup(false)} />

      <footer className="border-t border-pa-line bg-pa-bg">
        <div className="mx-auto grid max-w-[1200px] grid-cols-2 gap-6 px-5 pt-10 pb-6 sm:grid-cols-4 sm:px-8">
          <div className="col-span-2 sm:col-span-4">
            <BrandMark size={24} />
          </div>
          <div>
            <p className="eyebrow mb-3">Product</p>
            <div className="flex flex-col gap-2 text-[13px]">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.id}
                  href={link.href}
                  className="text-pa-ink/65 hover:text-pa-ink"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
          <div>
            <p className="eyebrow mb-3">Company</p>
            <div className="flex flex-col gap-2 text-[13px]">
              {["About", "Careers", "Contact"].map((item) => (
                <a key={item} href="#main-content" className="text-pa-ink/65 hover:text-pa-ink">
                  {item}
                </a>
              ))}
            </div>
          </div>
          <div>
            <p className="eyebrow mb-3">Resources</p>
            <div className="flex flex-col gap-2 text-[13px]">
              <Link href={LANDING_AUTH.whitby} className="text-pa-ink/65 hover:text-pa-ink">
                Help Center
              </Link>
              <a
                href="#security"
                className="text-pa-ink/65 hover:text-pa-ink"
                onClick={(event) => {
                  event.preventDefault();
                  scrollToId("security");
                }}
              >
                Security
              </a>
              <Link href={LANDING_AUTH.programTerms} className="text-pa-ink/65 hover:text-pa-ink">
                Program Terms
              </Link>
              <Link href={LANDING_AUTH.academyVerify} className="text-pa-ink/65 hover:text-pa-ink">
                Verify certificate
              </Link>
            </div>
          </div>
          <div>
            <p className="eyebrow mb-3">Get started</p>
            <div className="flex flex-col gap-2 text-[13px]">
              <Link
                href={LANDING_AUTH.partnerApply}
                className="text-left text-pa-ink/65 no-underline hover:text-pa-ink"
              >
                Apply as a partner
              </Link>
              <Link
                href={LANDING_AUTH.bookWalkthrough}
                className="text-left text-pa-ink/65 no-underline hover:text-pa-ink"
              >
                Book a walkthrough
              </Link>
              <Link
                href={LANDING_AUTH.signIn}
                className="text-left text-pa-ink/65 no-underline hover:text-pa-ink"
              >
                Log in
              </Link>
            </div>
          </div>
        </div>
        <div className="mx-auto max-w-[1200px] px-5 pt-4 pb-7 text-xs text-pa-muted sm:px-8">
          © 2026 Private Attaché. Discretion is the product.
        </div>
      </footer>
    </div>
  );
}
