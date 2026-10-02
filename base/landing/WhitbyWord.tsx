"use client";

import { cn } from "@/base/lib/cn";

type WhitbyWordProps = {
  className?: string;
  /** Flat ink typography — no glass or write-on animation. */
  staticMark?: boolean;
};

/** Default: animated word mark. Use `staticMark` for flat professional typography. */
export function WhitbyWord({ className, staticMark }: WhitbyWordProps) {
  if (staticMark) {
    return (
      <span className={cn("whitby-word whitby-word--static", className)}>
        Whitby
      </span>
    );
  }

  return (
    <span className={cn("whitby-word", className)}>
      <span className="whitby-word__glass" aria-hidden />
      <span className="whitby-word__text">Whitby</span>
    </span>
  );
}
