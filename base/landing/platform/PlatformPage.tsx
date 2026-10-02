"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BrandMark } from "@/base/landing/brand/Monogram";
import { LANDING_AUTH } from "@/base/landing/auth";
import { SignupModal } from "@/base/landing/SignupModal";
import { NotionSection } from "@/base/landing/NotionSection";
import { SiteNav } from "@/base/landing/SiteNav";
import { WhitbyAssistant } from "@/base/landing/WhitbyAssistant";
import { PlatformCapabilitySection } from "@/base/landing/platform/PlatformCapabilitySection";
import { cn } from "@/base/lib/cn";
import { chatReply } from "@/base/landing/content";
import { MODULE_SLUGS, moduleHref } from "@/base/landing/modules";
import { NAV_LINKS } from "@/base/landing/nav";
import { PLATFORM_OVERVIEW } from "@/base/landing/platform";
import "@/base/landing/styles/landing.css";

type ChatMessage = { from: "user" | "bot"; text: string };

export function PlatformPage() {
  const router = useRouter();
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
      <a href="#platform-main" className="skip-link">
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
        onSelectModule={(key) => router.push(moduleHref(key))}
      />

      <main id="platform-main" className="notion-in-view">
        <header className="platform-page-intro">
          <div className="notion-page notion-page--wide">
            <p className="notion-label">{PLATFORM_OVERVIEW.eyebrow}</p>
            <h1 className="platform-page-intro__title">{PLATFORM_OVERVIEW.title}</h1>
            <p className="platform-page-intro__lede">{PLATFORM_OVERVIEW.lede}</p>
          </div>
        </header>

        {MODULE_SLUGS.map((slug, index) => (
          <NotionSection
            key={slug}
            id={`capability-${slug}`}
            wide
            reveal={false}
            className={index === 0 ? "platform-section-first" : undefined}
          >
            <PlatformCapabilitySection slug={slug} reverse={index % 2 === 1} />
          </NotionSection>
        ))}
      </main>

      <SignupModal open={showSignup} onClose={() => setShowSignup(false)} />

      <footer className="border-t border-pa-line bg-pa-bg">
        <div className="mx-auto grid max-w-[1200px] grid-cols-2 gap-6 px-5 pt-10 pb-6 sm:grid-cols-4 sm:px-8">
          <div className="col-span-2 sm:col-span-4">
            <BrandMark size={24} />
          </div>
          <div>
            <p className="eyebrow mb-3">Product</p>
            <div className="flex flex-col gap-2 text-[13px]">
              <Link href={PLATFORM_OVERVIEW.href} className="text-pa-ink/65 hover:text-pa-ink">
                Platform overview
              </Link>
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
                <Link key={item} href="/" className="text-pa-ink/65 hover:text-pa-ink">
                  {item}
                </Link>
              ))}
            </div>
          </div>
          <div>
            <p className="eyebrow mb-3">Resources</p>
            <div className="flex flex-col gap-2 text-[13px]">
              <Link href={LANDING_AUTH.whitby} className="text-pa-ink/65 hover:text-pa-ink">
                Help Center
              </Link>
              <Link href="/#security" className="text-pa-ink/65 hover:text-pa-ink">
                Security & discretion
              </Link>
              <Link href={LANDING_AUTH.programTerms} className="text-pa-ink/65 hover:text-pa-ink">
                Program Terms
              </Link>
            </div>
          </div>
          <div>
            <p className="eyebrow mb-3">Get started</p>
            <div className="flex flex-col gap-2 text-[13px]">
              <Link href={LANDING_AUTH.partnerApply} className="text-left text-pa-ink/65 no-underline hover:text-pa-ink">
                Apply as a partner
              </Link>
              <Link href={LANDING_AUTH.bookWalkthrough} className="text-left text-pa-ink/65 no-underline hover:text-pa-ink">
                Book a walkthrough
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
