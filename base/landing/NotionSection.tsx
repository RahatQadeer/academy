"use client";

import { cn } from "@/base/lib/cn";
import { NotionReveal } from "@/base/landing/NotionReveal";
import type { ReactNode } from "react";

type NotionSectionProps = {
  id?: string;
  children: ReactNode;
  className?: string;
  wide?: boolean;
  /** Stagger entrance vs. other sections while scrolling. */
  revealDelay?: number;
  /** Set false on dense pages (e.g. /platform) so content never waits on scroll observers. */
  reveal?: boolean;
};

export function NotionSection({
  id,
  children,
  className,
  wide,
  revealDelay = 0,
  reveal = true,
}: NotionSectionProps) {
  const inner = (
    <div className={cn(wide ? "notion-page notion-page--wide" : "notion-page")}>
      {children}
    </div>
  );

  return (
    <section id={id} className={cn("notion-section", className)}>
      {reveal ? <NotionReveal delay={revealDelay}>{inner}</NotionReveal> : inner}
    </section>
  );
}

export function NotionHeading({
  label,
  title,
  lede,
}: {
  label?: string;
  title: string;
  lede?: string;
}) {
  return (
    <header className="notion-heading">
      {label ? <p className="notion-label">{label}</p> : null}
      <h2 className="notion-h2">{title}</h2>
      {lede ? <p className="notion-lede">{lede}</p> : null}
    </header>
  );
}
