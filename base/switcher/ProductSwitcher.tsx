"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { initialsFrom } from "@/base/components/Avatar";
import { PRODUCTS, getProduct } from "@/base/switcher/products";
import { productState, visibleProducts } from "@/base/identity/entitlements";
import type { Entitlement, ProductKey } from "@/base/types";
import { cn } from "@/base/lib/cn";

type ProductSwitcherProps = {
  currentProduct: ProductKey;
  workspaceName?: string;
  /**
   * The line under the name — what this workspace is on.
   *
   * A masthead of a mark and a word is a masthead with nothing in it. This is
   * the one fact about a workspace that belongs at the head of its own rail
   * rather than three screens away in Billing.
   */
  workspaceNote?: string;
  /** The workspace's own mark, shown instead of its initials when it has one. */
  workspaceLogo?: string | null;
  roleTag?: string;
  roleTagStyle?: { background: string; color: string };
  roleLabel?: string;
  entitlements?: Entitlement[];
  previewAll?: boolean;
  compact?: boolean;
  bare?: boolean;
  /** When set, the workspace name opens this overview; the chevron still switches products. */
  workspaceHref?: string;
  /**
   * How Client Portal appears in this menu.
   *
   * It is not a standalone product professionals switch into. Invited clients
   * open it (`open`). A Whitby plan that does not include it offers an upgrade
   * (`upgrade`). Otherwise the row is omitted (`hidden`).
   */
  portalAccess?: "open" | "hidden" | "upgrade";
  /** Where the upgrade row goes. Billing, unless a caller is still in onboarding. */
  portalUpgradeHref?: string;
  /** Overview-sized mark and name, for Whitby's product rail. */
  masthead?: boolean;
  /** Name and plan sit on one row, for the top bar. */
  bar?: boolean;
  /**
   * The name alone, with nothing to open.
   *
   * For a client who was invited into one professional's portal and has no
   * product of their own. The menu would list products that are not theirs
   * and a way to the switcher they are never sent to, so the head of the rail
   * only says whose workspace this is.
   */
  noSwitch?: boolean;
};

export function ProductSwitcher({
  currentProduct,
  workspaceName,
  workspaceNote,
  workspaceLogo,
  roleTag,
  roleTagStyle,
  roleLabel,
  entitlements = [],
  previewAll = false,
  compact = false,
  bare = false,
  workspaceHref,
  portalAccess = "open",
  portalUpgradeHref = "/whitbyos/settings/billing",
  masthead = false,
  bar = false,
  noSwitch = false,
}: ProductSwitcherProps) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();
  const current = getProduct(currentProduct);
  const products = (previewAll ? PRODUCTS : visibleProducts(entitlements)).filter((product) => {
    if (product.key !== "client_portal") return true;
    // Respect explicit hide even in preview — Partner Center never surfaces portal.
    if (portalAccess === "hidden") return false;
    if (previewAll) return true;
    return portalAccess === "open";
  });
  const usingRoleLabel = Boolean(roleLabel);
  const usingProductBrand = Boolean(roleTag) || usingRoleLabel;
  const label = usingRoleLabel ? roleLabel! : usingProductBrand ? current.name : workspaceName ?? current.name;
  const usingWorkspace = Boolean(workspaceName) && !usingProductBrand;
  const markSize = bar ? 32 : masthead ? (compact ? 32 : 34) : compact ? 22 : 24;
  const markRadius = bar || masthead ? 10 : usingWorkspace ? 999 : 8;
  const mark = usingWorkspace ? initialsFrom(workspaceName!) : current.glyph;
  const nameOpensWorkspaces = Boolean(workspaceHref) && usingWorkspace && !compact;
  const planChip = (workspaceNote ?? "Organization").replace(/\s+plan$/i, "");
  // A role label replaces the mark entirely, so there is nowhere to put one.
  const showLogo = Boolean(workspaceLogo) && !usingRoleLabel;
  const tagColors = roleTagStyle ?? {
    background: "var(--module-academy-bg)",
    color: "var(--module-academy-fg)",
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
      setMenuPos({ top: rect.bottom + 6, left });
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

  if (noSwitch) {
    return (
      <StaticName
        name={label}
        mark={mark}
        logo={showLogo ? workspaceLogo! : null}
        size={markSize}
        radius={markRadius}
        compact={compact}
      />
    );
  }

  return (
    <div
      className={cn(
        "relative min-w-0",
        bare ? "" : compact ? "px-0 pb-2 pt-0" : "px-0 pb-1 pt-0",
      )}
    >
      {nameOpensWorkspaces ? (
        <div className={cn("pa-org-mast", bar && "is-bar")}>
          <Link
            href={workspaceHref!}
            title="Workspaces"
            aria-label={`Open ${label} workspaces`}
            className="pa-org-mast-main"
          >
            {showLogo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={workspaceLogo as string}
                alt=""
                className="pa-org-mark select-none"
                style={{ width: markSize, height: markSize, borderRadius: markRadius }}
              />
            ) : (
              <span
                className="pa-org-mark inline-flex shrink-0 items-center justify-center font-bold select-none"
                style={{
                  width: markSize,
                  height: markSize,
                  borderRadius: markRadius,
                  background: "var(--ink)",
                  color: "#fff",
                  fontSize: 13,
                }}
                aria-hidden
              >
                {mark}
              </span>
            )}
            <span className={cn("min-w-0", bar ? "flex items-center gap-2" : "flex-1")}>
              <span className="pa-org-name">{label}</span>
              <span className="pa-org-plan">{planChip}</span>
            </span>
          </Link>
          <button
            ref={triggerRef}
            type="button"
            aria-haspopup="dialog"
            aria-expanded={open}
            aria-controls={open ? menuId : undefined}
            aria-label="Switch product"
            onClick={() => setOpen((value) => !value)}
            className="pa-org-mast-switch"
          >
            <Chevron open={open} />
          </button>
        </div>
      ) : (
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label="Switch product"
        onClick={() => setOpen((value) => !value)}
        className={cn(
          "w-full rounded-[8px] text-left transition-colors hover:bg-[var(--chrome-hover)]",
          compact ? "flex justify-center px-0 py-0" : "px-1 py-0",
        )}
        style={{ color: "var(--ink)", background: "transparent" }}
      >
        {usingRoleLabel ? (
          compact ? (
            <Chevron open={open} />
          ) : (
            <span className="flex w-full items-center justify-between gap-2">
              <span className="truncate text-[13.5px] font-semibold leading-none tracking-[-0.2px]">
                {label}
              </span>
              <Chevron open={open} />
            </span>
          )
        ) : compact ? (
          showLogo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={workspaceLogo as string}
              alt=""
              className="pa-org-mark shrink-0 select-none"
              style={{ width: markSize, height: markSize, borderRadius: markRadius }}
            />
          ) : (
            <span
              className="inline-flex shrink-0 items-center justify-center font-bold select-none"
              style={{
                width: markSize,
                height: markSize,
                borderRadius: markRadius,
                background: current.iconBg,
                color: current.iconFg,
                fontSize: current.glyph.length > 1 ? 8 : 11,
                boxShadow: masthead ? "0 0 0 1px var(--chrome-line)" : undefined,
              }}
              aria-hidden
            >
              {mark}
            </span>
          )
        ) : (
          <span className={cn("flex w-full items-center", roleTag ? "items-start gap-2.5" : "gap-2.5")}>
            {showLogo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={workspaceLogo as string}
                alt=""
                className={cn("pa-org-mark shrink-0 select-none", roleTag && "mt-0.5")}
                style={{ width: markSize, height: markSize, borderRadius: markRadius }}
              />
            ) : (
            <span
              className={cn(
                "inline-flex shrink-0 items-center justify-center font-bold select-none",
                roleTag && "mt-0.5",
              )}
              style={
                usingWorkspace
                  ? {
                      width: markSize,
                      height: markSize,
                      borderRadius: markRadius,
                      background: "var(--ink)",
                      color: "#fff",
                      fontSize: masthead ? 13 : 9,
                      boxShadow: masthead ? "0 0 0 1px var(--chrome-line)" : undefined,
                    }
                  : {
                      width: markSize,
                      height: markSize,
                      borderRadius: markRadius,
                      background: current.iconBg,
                      color: current.iconFg,
                      fontSize: current.glyph.length > 1 ? 8 : 12,
                    }
              }
              aria-hidden
            >
              {mark}
            </span>
            )}
            {roleTag ? (
              <span className="min-w-0 flex-1">
                <span className="flex items-center justify-between gap-2">
                  <span className="text-[13.5px] font-semibold leading-none tracking-[-0.2px]">{label}</span>
                  <Chevron open={open} />
                </span>
                <span className="mt-2 inline-flex">
                  <span
                    className="inline-flex items-center rounded-[5px] px-2 py-[3px] text-[10.5px] font-semibold leading-none"
                    style={{
                      background: tagColors.background,
                      color: tagColors.color,
                      boxShadow: `inset 0 0 0 1px ${tagColors.color}22`,
                    }}
                  >
                    {roleTag}
                  </span>
                </span>
              </span>
            ) : (
              <>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-bold leading-tight tracking-[-0.2px]">
                    {label}
                  </span>
                  {workspaceNote ? (
                    <span
                      className={cn(
                        "mt-[2px] block truncate leading-tight",
                        masthead ? "text-[11.5px]" : "text-[11px] font-medium uppercase tracking-[0.06em]",
                      )}
                      style={{ color: masthead ? "var(--text-tertiary)" : "var(--text-quiet)" }}
                    >
                      {workspaceNote}
                    </span>
                  ) : masthead ? (
                    <span className="mt-[2px] block truncate text-[11.5px] leading-tight" style={{ color: "var(--text-tertiary)" }}>
                      Organization
                    </span>
                  ) : null}
                </span>
                <Chevron open={open} />
              </>
            )}
          </span>
        )}
      </button>
      )}

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
                className="absolute w-[280px] rounded-[10px] bg-surface py-2.5"
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
                    const selected = product.key === currentProduct;
                    const entitled =
                      previewAll || productState(product.key, entitlements) === "available";
                    const href = entitled ? product.href : product.applyHref || product.href;

                    return (
                      <Link
                        key={product.key}
                        href={href}
                        onClick={() => setOpen(false)}
                        className={cn(
                          "flex items-center gap-2.5 rounded-[9px] px-2 py-2 no-underline transition-colors",
                          !entitled && "opacity-55",
                          !selected && "hover:bg-[var(--surface-soft)]",
                        )}
                        // The one you are in is tinted, not boxed. A 1.5px
                        // accent outline around one of four rows drew a
                        // rectangle on the panel; the tint and the tick say it
                        // without adding a shape.
                        style={{
                          color: "var(--ink)",
                          background: selected ? "var(--accent-tint)" : "transparent",
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
                          <span
                            className="block text-[14px] font-semibold leading-tight"
                            style={selected ? { color: "var(--accent)" } : undefined}
                          >
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
                  {portalAccess === "upgrade" && !previewAll ? (
                    <Link
                      href={portalUpgradeHref}
                      onClick={() => setOpen(false)}
                      className="flex items-center gap-2.5 rounded-[9px] px-2 py-2 no-underline transition-colors hover:bg-[var(--surface-soft)]"
                      style={{ color: "var(--ink)" }}
                    >
                      <span
                        className="inline-flex h-[34px] w-[34px] shrink-0 items-center justify-center text-[12px] font-semibold"
                        style={{
                          background: "var(--module-portal-bg)",
                          color: "var(--module-portal-fg)",
                          borderRadius: 9,
                        }}
                      >
                        CP
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[14px] font-semibold leading-tight">
                          Enable Client Portal
                        </span>
                        <span
                          className="mt-0.5 block text-[12.5px] leading-tight"
                          style={{ color: "var(--text-secondary)" }}
                        >
                          Upgrade your plan
                        </span>
                      </span>
                    </Link>
                  ) : null}
                </div>
                {/*
                 * One way out, and it is about products.
                 *
                 * "Workspaces" and "Add workspace" were here as well as
                 * on Switch workspace, which is the panel whose whole subject
                 * they are. A panel headed "Switch product" that also offers
                 * two ways to change workspace is two panels doing one
                 * another's job, and somebody has to learn which is which.
                 */}
                <div className="mx-3 mt-1.5 border-t border-line pt-1.5">
                  <Link
                    href="/switcher"
                    onClick={() => setOpen(false)}
                    className="flex items-center justify-between gap-2 rounded-[7px] px-2 py-[7px] text-[13px] font-medium no-underline transition-colors hover:bg-[var(--surface-soft)]"
                  >
                    Compare all products
                    <span aria-hidden style={{ color: "var(--text-quiet)" }}>
                      →
                    </span>
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

/** The head of the rail when there is nowhere to switch to. */
function StaticName({
  name,
  mark,
  logo,
  size,
  radius,
  compact,
}: {
  name: string;
  mark: string;
  logo: string | null;
  size: number;
  radius: number;
  compact: boolean;
}) {
  const markNode = logo ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={logo}
      alt=""
      className="pa-org-mark shrink-0 select-none"
      style={{ width: size, height: size, borderRadius: radius }}
    />
  ) : (
    <span
      className="inline-flex shrink-0 items-center justify-center font-bold select-none"
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        background: "var(--ink)",
        color: "#fff",
        fontSize: 13,
      }}
      aria-hidden
    >
      {mark}
    </span>
  );

  if (compact) {
    return (
      <div className="flex justify-center" title={name}>
        {markNode}
      </div>
    );
  }

  return (
    <div className="flex min-w-0 items-center gap-2.5 px-1" style={{ color: "var(--ink)" }}>
      {markNode}
      <span className="block min-w-0 flex-1 truncate text-[15px] font-bold leading-tight tracking-[-0.2px]" title={name}>
        {name}
      </span>
    </div>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      aria-hidden
      className="shrink-0"
      style={{
        color: "var(--text-tertiary)",
        transform: open ? "rotate(180deg)" : "none",
        transition: "transform 120ms ease",
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
