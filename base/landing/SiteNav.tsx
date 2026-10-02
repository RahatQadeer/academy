"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { BrandMark } from "@/base/landing/brand/Monogram";
import {
  IconClose,
  IconWhitby,
  MODULE_ICONS,
} from "@/base/landing/brand/Icons";
import {
  PLATFORM_MODULES,
  PLATFORM_OVERVIEW_LINK,
  PRIMARY_NAV,
  RESOURCES_LINKS,
  SOLUTIONS_COLUMNS,
} from "@/base/landing/nav";
import { LANDING_AUTH } from "@/base/landing/auth";
import { cn } from "@/base/lib/cn";
import type { ModuleKey } from "@/base/landing/content";
import { moduleHref } from "@/base/landing/modules";

type SiteNavProps = {
  onOpenAssistant: () => void;
  onOpenSignup: () => void;
  onSelectModule?: (key: ModuleKey) => void;
  chatOpen?: boolean;
  /** Sits inside gigantism hero shell; pins to viewport after hero scrolls away */
  placement?: "fixed" | "inset";
};

function Chevron({ open }: { open?: boolean }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      aria-hidden
      className={cn(
        "transition-transform duration-200",
        open && "rotate-180",
      )}
    >
      <path
        d="M3 4.5 6 7.5 9 4.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function scrollToHash(hash: string) {
  const id = hash.replace(/^#/, "");
  if (!id) return;
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

export function SiteNav({
  onOpenAssistant,
  onOpenSignup,
  onSelectModule,
  chatOpen = false,
  placement = "fixed",
}: SiteNavProps) {
  const inset = placement === "inset";
  const router = useRouter();
  const [openMenu, setOpenMenu] = useState<
    "platform" | "solutions" | "resources" | null
  >(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobilePlatformOpen, setMobilePlatformOpen] = useState(true);
  const [mobileSolutionsOpen, setMobileSolutionsOpen] = useState(false);
  const [mobileResourcesOpen, setMobileResourcesOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [heroInView, setHeroInView] = useState(true);
  const navRef = useRef<HTMLElement>(null);
  const platformId = useId();
  const solutionsId = useId();
  const resourcesId = useId();

  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 8);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!inset) return;
    const hero = document.getElementById("section-whitby");
    if (!hero) return;
    const observer = new IntersectionObserver(
      ([entry]) => setHeroInView(entry.isIntersecting),
      { root: null, threshold: 0, rootMargin: "-8% 0px 0px 0px" },
    );
    observer.observe(hero);
    return () => observer.disconnect();
  }, [inset]);

  useEffect(() => {
    function onPointer(event: MouseEvent) {
      if (!navRef.current?.contains(event.target as Node)) {
        setOpenMenu(null);
      }
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpenMenu(null);
        setMobileOpen(false);
      }
    }
    document.addEventListener("mousedown", onPointer);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  function go(href: string, moduleKey?: ModuleKey) {
    setOpenMenu(null);
    setMobileOpen(false);

    if (href.startsWith("/modules/")) {
      if (moduleKey && onSelectModule) onSelectModule(moduleKey);
      else router.push(href);
      return;
    }

    if (href.startsWith("/#")) {
      const hash = href.slice(1);
      if (window.location.pathname !== "/") {
        router.push(href);
        return;
      }
      scrollToHash(hash);
      return;
    }

    if (href.startsWith("#")) {
      if (window.location.pathname !== "/") {
        router.push(`/${href}`);
        return;
      }
      scrollToHash(href);
      return;
    }

    if (href.startsWith("/")) {
      router.push(href);
    }
  }

  const navItemClass =
    "inline-flex items-center gap-1 rounded-md px-3 py-2 transition-colors duration-200 hover:bg-pa-panel hover:text-pa-ink";

  const insetPinned = inset && !heroInView;
  const useFixedBar = !inset || insetPinned;

  const header = (
      <header
        ref={navRef}
        data-theme="notion"
        className={cn(
          "site-nav-header site-nav-header--flat pointer-events-none z-[100]",
          inset && !insetPinned && "site-nav-header--inset relative",
          useFixedBar
            ? cn(
                "fixed top-0",
                chatOpen ? "right-0 md:right-[420px] left-0" : "inset-x-0",
              )
            : "relative",
        )}
      >
        <div
          className="site-nav-mega pointer-events-auto w-full"
          onMouseLeave={() => {
            if (!mobileOpen) setOpenMenu(null);
          }}
        >
          <div
            className={cn(
              "site-nav-bar",
              scrolled && "site-nav-bar--scrolled",
            )}
          >
            <div className="relative z-[3] mx-auto flex max-w-[1200px] items-center justify-between gap-3 px-4 py-3 sm:px-6">
                <div className="flex min-w-0 items-center gap-2 sm:gap-2.5">
                  <Link
                    href="/"
                    className="min-w-0 shrink-0"
                    onClick={() => {
                      setOpenMenu(null);
                      setMobileOpen(false);
                    }}
                  >
                    <BrandMark size={22} />
                  </Link>
                  <button
                    type="button"
                    className="ask-whitby-nav inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[12.5px] font-semibold sm:gap-1.5 sm:px-3 sm:text-[13px]"
                    onClick={onOpenAssistant}
                  >
                    <IconWhitby size={14} />
                    Ask Whitby
                  </button>
                </div>

                <nav className="hidden items-center justify-center gap-x-0.5 text-[13.5px] font-medium text-pa-ink/75 lg:flex">
                  {PRIMARY_NAV.map((item) => {
                    if (item.hasMenu) {
                      const isOpen = openMenu === item.id;
                      const menuId =
                        item.id === "platform"
                          ? platformId
                          : item.id === "solutions"
                            ? solutionsId
                            : resourcesId;
                      return (
                        <div key={item.id} className="relative">
                          <button
                            type="button"
                            className={cn(
                              navItemClass,
                              isOpen && "bg-pa-panel text-pa-ink",
                            )}
                            aria-expanded={isOpen}
                            aria-controls={menuId}
                            onClick={() =>
                              setOpenMenu(isOpen ? null : item.id)
                            }
                            onMouseEnter={() => setOpenMenu(item.id)}
                          >
                            {item.label}
                            <Chevron open={isOpen} />
                          </button>
                        </div>
                      );
                    }

                    return (
                      <a
                        key={item.id}
                        href={item.href}
                        className={cn(
                          navItemClass,
                          item.id === "academy" &&
                            "font-semibold text-pa-ink/90",
                        )}
                        onClick={(event) => {
                          event.preventDefault();
                          go(
                            item.href,
                            item.id === "academy" ? "academy" : undefined,
                          );
                        }}
                      >
                        {item.label}
                      </a>
                    );
                  })}
                </nav>

                <div className="flex shrink-0 items-center justify-end gap-2 sm:gap-2.5">
                  <Link
                    href={LANDING_AUTH.signIn}
                    className="hidden rounded-md border border-pa-line bg-white px-4 py-2 text-[13px] font-semibold text-pa-ink no-underline transition-colors duration-200 hover:bg-pa-panel lg:inline-flex"
                  >
                    Log in
                  </Link>
                  <button
                    type="button"
                    className="whitespace-nowrap rounded-full bg-pa-ink px-3.5 py-2 text-[13px] font-semibold text-white transition-transform duration-200 hover:-translate-y-px sm:px-5"
                    onClick={onOpenSignup}
                  >
                    Get started
                  </button>
                  <button
                    type="button"
                    className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-pa-line bg-white text-pa-ink transition-colors duration-200 hover:bg-pa-panel lg:hidden"
                    aria-label="Menu"
                    aria-expanded={mobileOpen}
                    onClick={() => setMobileOpen((open) => !open)}
                  >
                    {mobileOpen ? (
                      <IconClose size={18} />
                    ) : (
                      <span className="flex flex-col gap-[5px]" aria-hidden>
                        <span className="block h-0.5 w-[18px] rounded-full bg-current" />
                        <span className="block h-0.5 w-[18px] rounded-full bg-current" />
                        <span className="block h-0.5 w-[18px] rounded-full bg-current" />
                      </span>
                    )}
                  </button>
                </div>
            </div>
          </div>

          {openMenu === "platform" && (
            <div
              id={platformId}
              className="site-nav-dropdown hidden lg:block"
            >
              <div className="mx-auto max-w-[1200px] px-4 py-4 sm:px-6">
                <button
                  type="button"
                  onClick={() => go(PLATFORM_OVERVIEW_LINK.href)}
                  className="mb-2 flex max-w-[520px] w-full flex-col rounded-xl px-3 py-3 text-left transition-colors duration-200 hover:bg-pa-bg"
                >
                  <span className="text-[14px] font-bold text-pa-ink">
                    {PLATFORM_OVERVIEW_LINK.title}
                  </span>
                  <span className="mt-1 text-[12.5px] leading-snug text-pa-muted">
                    {PLATFORM_OVERVIEW_LINK.description}
                  </span>
                </button>
                <div className="max-w-[520px] pb-1 pt-1 text-[12px] font-bold tracking-[0.08em] text-pa-muted uppercase">
                  Capabilities
                </div>
                <div className="flex max-w-[520px] flex-col gap-0.5">
                {PLATFORM_MODULES.map((item) => {
                  const Icon = MODULE_ICONS[item.key];
                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => go(item.href)}
                      className="flex items-start gap-3 rounded-xl px-3 py-3 text-left transition-colors duration-200 hover:bg-pa-bg"
                    >
                      <span className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-lg bg-pa-panel text-pa-ink">
                        <Icon size={16} />
                      </span>
                      <span>
                        <span className="block text-[14px] font-bold text-pa-ink">
                          {item.title}
                        </span>
                        <span className="mt-1 block text-[12.5px] leading-snug text-pa-muted">
                          {item.description}
                        </span>
                      </span>
                    </button>
                  );
                })}
                </div>
              </div>
            </div>
          )}

          {openMenu === "solutions" && (
            <div
              id={solutionsId}
              className="site-nav-dropdown hidden lg:block"
            >
              <div className="mx-auto max-w-[1200px] px-4 py-5 sm:px-6">
                <div className="mb-4 px-1 text-[12px] font-bold tracking-[0.08em] text-pa-muted uppercase">
                  Solutions
                </div>
                <div className="grid grid-cols-4 gap-x-2">
                {SOLUTIONS_COLUMNS.map((column, columnIndex) => (
                  <div
                    key={columnIndex}
                    className="flex flex-col gap-0.5 border-pa-line/80 px-1 not-first:border-l"
                  >
                    {column.items.map((item) => (
                      <button
                        key={item.title}
                        type="button"
                        onClick={() => go(item.href)}
                        className="rounded-lg px-2.5 py-2.5 text-left text-[13.5px] font-semibold leading-snug text-pa-ink transition-colors duration-200 hover:bg-pa-bg"
                      >
                        {item.title}
                      </button>
                    ))}
                  </div>
                ))}
                </div>
              </div>
            </div>
          )}

          {openMenu === "resources" && (
            <div
              id={resourcesId}
              className="site-nav-dropdown hidden lg:block"
            >
              <div className="mx-auto max-w-[1200px] px-4 py-3 sm:px-6">
                <div className="max-w-[440px]">
              {RESOURCES_LINKS.map((item) => (
                <button
                  key={item.title}
                  type="button"
                  onClick={() => {
                    if (item.title === "Book a walkthrough") onOpenSignup();
                    else go(item.href);
                  }}
                  className="flex w-full flex-col rounded-xl px-4 py-3 text-left transition-colors duration-200 hover:bg-pa-bg"
                >
                  <span className="text-[14px] font-bold text-pa-ink">
                    {item.title}
                  </span>
                  <span className="mt-1 text-[12.5px] text-pa-muted">
                    {item.description}
                  </span>
                </button>
              ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {mobileOpen && (
            <div className="nav-mobile-panel pointer-events-auto lg:hidden">
              <nav className="flex flex-col gap-0.5 px-2.5 py-2.5">
                <button
                  type="button"
                  className="nav-mobile-acc"
                  aria-expanded={mobilePlatformOpen}
                  onClick={() => setMobilePlatformOpen((open) => !open)}
                >
                  Platform
                  <Chevron open={mobilePlatformOpen} />
                </button>
                {mobilePlatformOpen && (
                  <div className="nav-mobile-acc-body">
                    <button
                      type="button"
                      className="nav-mobile-link font-semibold"
                      onClick={() => go(PLATFORM_OVERVIEW_LINK.href)}
                    >
                      {PLATFORM_OVERVIEW_LINK.title}
                    </button>
                    <div className="nav-mobile-acc-label">Capabilities</div>
                    {PLATFORM_MODULES.map((item) => (
                      <button
                        key={item.key}
                        type="button"
                        className="nav-mobile-link"
                        onClick={() => go(item.href)}
                      >
                        {item.title}
                      </button>
                    ))}
                  </div>
                )}

                <button
                  type="button"
                  className="nav-mobile-acc font-semibold text-pa-ink"
                  onClick={() => go(moduleHref("academy"), "academy")}
                >
                  Academy
                </button>

                <button
                  type="button"
                  className="nav-mobile-acc"
                  aria-expanded={mobileSolutionsOpen}
                  onClick={() => setMobileSolutionsOpen((open) => !open)}
                >
                  Solutions
                  <Chevron open={mobileSolutionsOpen} />
                </button>
                {mobileSolutionsOpen && (
                  <div className="nav-mobile-acc-body">
                    {SOLUTIONS_COLUMNS.map((column, columnIndex) => (
                      <div
                        key={columnIndex}
                        className={cn(
                          columnIndex > 0 &&
                            "mt-2 border-t border-pa-line/80 pt-2",
                        )}
                      >
                        {column.items.map((item) => (
                          <button
                            key={item.title}
                            type="button"
                            className="nav-mobile-link"
                            onClick={() => go(item.href)}
                          >
                            {item.title}
                          </button>
                        ))}
                      </div>
                    ))}
                  </div>
                )}

                <button
                  type="button"
                  className="nav-mobile-acc"
                  aria-expanded={mobileResourcesOpen}
                  onClick={() => setMobileResourcesOpen((open) => !open)}
                >
                  Resources
                  <Chevron open={mobileResourcesOpen} />
                </button>
                {mobileResourcesOpen && (
                  <div className="nav-mobile-acc-body">
                    {RESOURCES_LINKS.map((item) => (
                      <button
                        key={item.title}
                        type="button"
                        className="nav-mobile-link"
                        onClick={() => {
                          if (item.title === "Book a walkthrough") {
                            setMobileOpen(false);
                            onOpenSignup();
                          } else {
                            go(item.href);
                          }
                        }}
                      >
                        {item.title}
                      </button>
                    ))}
                  </div>
                )}

                {PRIMARY_NAV.filter(
                  (item): item is Extract<typeof item, { href: string }> =>
                    !item.hasMenu,
                ).map((item) => (
                  <a
                    key={item.id}
                    href={item.href}
                    className="nav-mobile-acc"
                    onClick={(event) => {
                      event.preventDefault();
                      go(item.href);
                    }}
                  >
                    {item.label}
                  </a>
                ))}

                <div className="mt-1.5 border-t border-pa-line pt-1.5">
                  <button
                    type="button"
                    className="nav-mobile-acc"
                    style={{ color: "var(--pa-blue)" }}
                    onClick={() => {
                      setMobileOpen(false);
                      onOpenAssistant();
                    }}
                  >
                    <span className="inline-flex items-center gap-2">
                      <IconWhitby size={16} className="text-pa-blue" />
                      Ask Whitby
                    </span>
                  </button>
                  <Link
                    href={LANDING_AUTH.signIn}
                    className="nav-mobile-link no-underline"
                    onClick={() => setMobileOpen(false)}
                  >
                    Log in
                  </Link>
                </div>
              </nav>
            </div>
        )}
      </header>
  );

  return (
    <>
      {useFixedBar && <div className="site-nav-spacer shrink-0" aria-hidden />}
      {insetPinned && typeof document !== "undefined"
        ? createPortal(header, document.body)
        : header}
    </>
  );
}
