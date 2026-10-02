"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { BrandMark } from "@/base/landing/brand/Monogram";
import { MODULE_ICONS } from "@/base/landing/brand/Icons";
import { moduleGetStartedHref } from "@/base/landing/auth";
import { SignupModal } from "@/base/landing/SignupModal";
import { SiteNav } from "@/base/landing/SiteNav";
import { WhitbyAssistant } from "@/base/landing/WhitbyAssistant";
import { chatReply } from "@/base/landing/content";
import {
  MODULE_PAGES,
  MODULE_SLUGS,
  type ModuleSlug,
} from "@/base/landing/modules";
import { cn } from "@/base/lib/cn";
import "@/base/landing/styles/landing.css";

type ChatMessage = { from: "user" | "bot"; text: string };

type ModulePageViewProps = {
  slug: ModuleSlug;
};

export function ModulePageView({ slug }: ModulePageViewProps) {
  const router = useRouter();
  const page = MODULE_PAGES[slug];
  const Icon = MODULE_ICONS[page.key];

  const [showSignup, setShowSignup] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);

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
    setChatMessages((messages) => [
      ...messages,
      { from: "user", text: value },
      { from: "bot", text: chatReply(value) },
    ]);
  }

  return (
    <div
      data-theme="notion"
      className={cn(
        "pa-landing-root notion-doc min-h-screen w-full max-w-[100vw] overflow-x-clip bg-pa-bg text-pa-ink transition-[padding] duration-300 ease-out",
        chatOpen && "md:pl-[420px]",
      )}
    >
      <a href="#module-main" className="skip-link">
        Skip to content
      </a>

      <WhitbyAssistant
        open={chatOpen}
        onClose={() => setChatOpen(false)}
        onNewChat={() => {
          setChatMessages([]);
          setChatInput("");
        }}
        input={chatInput}
        onInputChange={setChatInput}
        onSend={sendAssistant}
        messages={chatMessages}
      />

      <SiteNav
        chatOpen={chatOpen}
        onOpenAssistant={() => openAssistant()}
        onOpenSignup={() => setShowSignup(true)}
        onSelectModule={(key) => router.push(`/modules/${key}`)}
      />

      <main id="module-main" className="relative">
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[420px] bg-[radial-gradient(ellipse_70%_60%_at_50%_0%,rgba(234,217,236,0.55)_0%,rgba(234,217,236,0.2)_45%,transparent_72%)]" />

        <section className="relative mx-auto max-w-[880px] px-5 pt-10 pb-16 sm:px-8 sm:pt-14 sm:pb-20">
          <div className="mb-8 flex flex-wrap items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-pa-blue shadow-[0_8px_24px_rgba(23,24,26,.06)]">
              <Icon size={22} />
            </span>
            <p className="eyebrow mb-0">{page.eyebrow}</p>
          </div>

          <h1 className="mb-4 text-[clamp(32px,4.5vw+12px,48px)] font-bold leading-[1.08] tracking-[-1.4px]">
            {page.headline}
          </h1>
          <p className="mb-10 max-w-[640px] text-[clamp(15px,1.3vw+10px,18px)] leading-relaxed text-pa-muted">
            {page.lede}
          </p>

          <div className="mb-14 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => setShowSignup(true)}
              className="rounded-full bg-pa-ink px-5 py-2.5 text-[13.5px] font-semibold text-white transition-transform duration-200 hover:-translate-y-px"
            >
              Get started
            </button>
            <button
              type="button"
              onClick={() => openAssistant(`How does ${page.title} work?`)}
              className="rounded-full border border-pa-line bg-white px-5 py-2.5 text-[13.5px] font-semibold text-pa-ink transition-colors duration-200 hover:border-pa-ink/30"
            >
              Ask Whitby about {page.title}
            </button>
          </div>

          <div className="mb-14">
            <h2 className="mb-5 text-lg font-bold tracking-[-0.3px]">
              How it works
            </h2>
            <ol className="grid gap-4 sm:grid-cols-2">
              {page.steps.map((step, index) => (
                <li
                  key={step.title}
                  className="rounded-[18px] border border-pa-line bg-white/80 px-5 py-5"
                >
                  <div className="mb-2 text-[11px] font-bold tracking-[0.08em] text-pa-blue uppercase">
                    Step {String(index + 1).padStart(2, "0")}
                  </div>
                  <div className="mb-1.5 text-[15px] font-bold">{step.title}</div>
                  <p className="text-[13.5px] leading-relaxed text-pa-muted">
                    {step.body}
                  </p>
                </li>
              ))}
            </ol>
          </div>

          <div className="mb-14">
            <h2 className="mb-5 text-lg font-bold tracking-[-0.3px]">
              What you get
            </h2>
            <div className="grid gap-4">
              {page.capabilities.map((item) => (
                <div
                  key={item.title}
                  className="rounded-[18px] border border-pa-line bg-pa-panel/80 px-5 py-5"
                >
                  <div className="mb-1.5 text-[15px] font-bold">{item.title}</div>
                  <p className="text-[13.5px] leading-relaxed text-pa-muted">
                    {item.body}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="mb-14">
            <h2 className="mb-5 text-lg font-bold tracking-[-0.3px]">
              Who it is for
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {page.forWhom.map((item) => (
                <div
                  key={item.title}
                  className="rounded-[18px] border border-pa-line bg-white px-5 py-5"
                >
                  <div className="mb-1.5 text-[15px] font-bold">{item.title}</div>
                  <p className="text-[13.5px] leading-relaxed text-pa-muted">
                    {item.body}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="mb-14 rounded-[24px] border border-pa-line bg-white px-6 py-8 sm:px-8">
            <p className="mb-2 text-[12px] font-bold tracking-[0.08em] text-pa-muted uppercase">
              The outcome
            </p>
            <p className="text-[17px] font-semibold leading-snug tracking-[-0.2px] text-pa-ink">
              {page.outcome}
            </p>
          </div>

          <div className="mb-4">
            <p className="eyebrow mb-3">All modules</p>
            <div className="flex flex-wrap gap-2">
              {MODULE_SLUGS.map((other) => {
                const meta = MODULE_PAGES[other];
                const OtherIcon = MODULE_ICONS[meta.key];
                const active = other === slug;
                return (
                  <Link
                    key={other}
                    href={`/modules/${other}`}
                    className={cn(
                      "inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-[13px] font-semibold transition-colors duration-200",
                      active
                        ? "border-pa-ink bg-pa-ink text-white"
                        : "border-pa-line bg-white text-pa-ink hover:border-pa-ink/30",
                    )}
                  >
                    <OtherIcon
                      size={14}
                      className={active ? "text-white" : "text-pa-blue"}
                    />
                    {meta.title}
                  </Link>
                );
              })}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-pa-line bg-pa-bg">
        <div className="mx-auto flex max-w-[1200px] flex-col gap-4 px-5 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <BrandMark size={22} />
          <Link
            href="/"
            className="text-[13px] font-medium text-pa-ink/65 hover:text-pa-ink"
          >
            Back to home
          </Link>
        </div>
      </footer>

      <SignupModal
        open={showSignup}
        onClose={() => setShowSignup(false)}
        emailHref={moduleGetStartedHref(slug)}
        googleNext={
          slug === "academy"
            ? "/academy"
            : slug === "portal"
              ? "/client-portal"
              : "/switcher"
        }
      />
    </div>
  );
}
