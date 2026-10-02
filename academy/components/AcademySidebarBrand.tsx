"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { PRODUCTS, getProduct } from "@/base/switcher/products";
import { productState, visibleProducts } from "@/base/identity/entitlements";
import type { Entitlement } from "@/base/types";
import { cn } from "@/base/lib/cn";

function Chevron({ open, className }: { open: boolean; className?: string }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 12 12"
      aria-hidden
      className={cn("shrink-0", className)}
      style={{
        color: "var(--text-tertiary)",
        transform: open ? "rotate(180deg)" : "none",
        transition: "transform 140ms ease",
      }}
    >
      <path
        d="M3 4.5L6 7.5L9 4.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden className="shrink-0">
      <path
        d="M3.5 8.5L6.5 11.5L12.5 4.5"
        fill="none"
        stroke="var(--accent)"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function AcademySidebarBrand({
  roleTag,
  roleTagStyle,
  entitlements = [],
  previewAll = false,
  collapsed = false,
}: {
  roleTag?: string;
  roleTagStyle?: { background: string; color: string };
  entitlements?: Entitlement[];
  previewAll?: boolean;
  collapsed?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();
  const current = getProduct("academy");
  const products = previewAll ? PRODUCTS : visibleProducts(entitlements);
  const tagColors = roleTagStyle ?? {
    background: "#f7f7f5",
    color: "#37352f",
  };

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;

    function place() {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const width = 280;
      const left = Math.min(rect.left, Math.max(8, window.innerWidth - width - 8));
      setMenuPos({ top: rect.bottom + 8, left });
    }

    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="relative min-w-0">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label="Academy — switch product"
        onClick={() => setOpen((value) => !value)}
        className={cn(
          "w-full rounded-[10px] text-left transition-colors hover:bg-black/[0.03]",
          collapsed ? "flex justify-center px-0 py-1" : "px-1 py-1",
        )}
        style={{ color: "var(--ink)", background: "transparent", border: "none" }}
      >
        {collapsed ? (
          <span
            className="inline-flex h-9 w-9 items-center justify-center rounded-[10px] text-[15px] font-bold"
            style={{ background: "var(--ink)", color: "#fff" }}
            aria-hidden
          >
            A
          </span>
        ) : (
          <span className="block">
            <span className="flex items-center gap-2">
              <span className="text-[22px] font-bold leading-none tracking-[-0.55px]">Academy</span>
              <Chevron open={open} className="mt-0.5" />
            </span>
            {roleTag ? (
              <span className="mt-2.5 inline-flex">
                <span
                  className="inline-flex items-center rounded-[6px] px-2 py-[3px] text-[10.5px] font-semibold leading-none"
                  style={{
                    background: tagColors.background,
                    color: tagColors.color,
                    boxShadow: "inset 0 0 0 1px rgba(55, 53, 47, 0.08)",
                  }}
                >
                  {roleTag}
                </span>
              </span>
            ) : null}
          </span>
        )}
      </button>

      {mounted && open
        ? createPortal(
            <div className="fixed inset-0 z-[80]">
              <button
                type="button"
                aria-label="Close product switcher"
                className="absolute inset-0 cursor-default bg-transparent"
                onClick={() => setOpen(false)}
              />
              <div
                id={menuId}
                role="dialog"
                aria-label="Switch product"
                className="absolute w-[280px] rounded-[12px] bg-surface py-2.5"
                style={{
                  top: menuPos.top,
                  left: menuPos.left,
                  border: "1px solid var(--border)",
                  boxShadow: "0 12px 40px rgba(15,15,15,.08)",
                }}
              >
                <p
                  className="px-3 pb-2 text-[12px] font-medium"
                  style={{ color: "var(--text-tertiary)" }}
                >
                  Switch product
                </p>
                <div className="flex flex-col gap-1 px-2">
                  {products.map((product) => {
                    const selected = product.key === current.key;
                    const entitled =
                      previewAll || productState(product.key, entitlements) === "available";
                    const href = entitled ? product.href : product.applyHref || product.href;

                    return (
                      <Link
                        key={product.key}
                        href={href}
                        onClick={() => setOpen(false)}
                        className={cn(
                          "flex items-center gap-2.5 rounded-[8px] px-2 py-2 no-underline",
                          !entitled && "opacity-60",
                        )}
                        style={{
                          color: "var(--ink)",
                          background: selected ? "#efefed" : "transparent",
                          border: selected
                            ? "1px solid rgba(55, 53, 47, 0.1)"
                            : "1px solid transparent",
                        }}
                      >
                        <span
                          className="inline-flex h-[34px] w-[34px] shrink-0 items-center justify-center text-[12px] font-semibold"
                          style={{
                            background: product.iconBg,
                            color: product.iconFg,
                            borderRadius: 9,
                          }}
                        >
                          {product.glyph}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-[14px] font-semibold leading-tight">
                            {product.name}
                          </span>
                          <span
                            className="mt-0.5 block text-[12.5px] leading-tight"
                            style={{ color: "var(--text-secondary)" }}
                          >
                            {product.tagline}
                          </span>
                        </span>
                        {selected ? <CheckIcon /> : null}
                      </Link>
                    );
                  })}
                </div>
                <div className="mx-3 mt-2 border-t border-line pt-2">
                  <Link
                    href="/switcher"
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-1.5 px-1 py-1 text-[13.5px] font-medium no-underline"
                    style={{ color: "var(--ink)" }}
                  >
                    All products
                  </Link>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
