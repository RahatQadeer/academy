"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";

function DotsIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <circle cx="8" cy="3.5" r="1.15" fill="currentColor" />
      <circle cx="8" cy="8" r="1.15" fill="currentColor" />
      <circle cx="8" cy="12.5" r="1.15" fill="currentColor" />
    </svg>
  );
}

function EditIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M10.8 2.8l2.4 2.4M3.2 12.8l-.7 2.5 2.5-.7 7.4-7.4-1.8-1.8-7.4 7.4z"
        stroke="currentColor"
        strokeWidth="1.35"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function HideIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M2.2 8s2.2-4.2 5.8-4.2S13.8 8 13.8 8s-2.2 4.2-5.8 4.2S2.2 8 2.2 8z"
        stroke="currentColor"
        strokeWidth="1.35"
        strokeLinejoin="round"
      />
      <circle cx="8" cy="8" r="1.6" stroke="currentColor" strokeWidth="1.35" />
      <path d="M3.2 12.8 12.8 3.2" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" />
    </svg>
  );
}

function DeleteIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M3.5 4.5h9M6.2 4.5V3.4a.9.9 0 0 1 .9-.9h1.8a.9.9 0 0 1 .9.9v1.1M12.2 4.5v8.1a1.2 1.2 0 0 1-1.2 1.2H5a1.2 1.2 0 0 1-1.2-1.2V4.5"
        stroke="currentColor"
        strokeWidth="1.35"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M6.6 7.2v3.2M9.4 7.2v3.2"
        stroke="currentColor"
        strokeWidth="1.35"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function CatalogRowMenu({
  programName,
  editHref,
  onDelete,
  onHide,
  deleteDisabled = false,
  deleteDisabledReason,
}: {
  programName: string;
  editHref: string;
  onDelete: () => void;
  onHide?: () => void;
  deleteDisabled?: boolean;
  deleteDisabledReason?: string;
}) {
  const menuId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const [placed, setPlaced] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useLayoutEffect(() => {
    if (!open) {
      setPlaced(false);
      return;
    }

    const GAP = 6;
    const PAD = 8;

    function place() {
      const trigger = triggerRef.current?.getBoundingClientRect();
      const menu = menuRef.current;
      if (!trigger) return;
      if (!menu) {
        window.requestAnimationFrame(place);
        return;
      }

      const width = menu.offsetWidth || 220;
      const height = menu.offsetHeight || 88;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const spaceBelow = vh - trigger.bottom - GAP - PAD;
      const spaceAbove = trigger.top - GAP - PAD;

      let top: number;
      if (spaceBelow >= height) {
        top = trigger.bottom + GAP;
      } else if (spaceAbove >= height) {
        top = trigger.top - GAP - height;
      } else if (spaceAbove > spaceBelow) {
        top = Math.max(PAD, trigger.top - GAP - height);
      } else {
        top = Math.min(trigger.bottom + GAP, vh - PAD - height);
      }
      top = Math.min(Math.max(PAD, top), Math.max(PAD, vh - PAD - height));

      let left = trigger.right - width;
      left = Math.min(Math.max(PAD, left), Math.max(PAD, vw - PAD - width));

      setPos({ top, left });
      setPlaced(true);
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

    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    }

    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const menu = open ? (
    <div
      ref={menuRef}
      id={menuId}
      role="menu"
      aria-label={`${programName} actions`}
      className="fixed z-[60] w-[220px] rounded-[10px] border border-line bg-surface py-1"
      style={{
        top: pos.top,
        left: pos.left,
        visibility: placed ? "visible" : "hidden",
        maxHeight: "calc(100vh - 16px)",
        overflowY: "auto",
        boxShadow: "0 8px 24px rgba(15,15,15,.1), 0 1px 2px rgba(15,15,15,.06)",
      }}
    >
      <Link
        role="menuitem"
        href={editHref}
        className="flex items-center gap-2.5 px-3 py-2 text-[13px] font-medium text-ink no-underline hover:bg-surface-soft"
        onClick={() => setOpen(false)}
      >
        <span style={{ color: "var(--text-tertiary)" }}>
          <EditIcon />
        </span>
        Edit
      </Link>
      {onHide ? (
        <button
          type="button"
          role="menuitem"
          className="flex w-full cursor-pointer items-center gap-2.5 border-none bg-transparent px-3 py-2 text-left text-[13px] font-medium text-ink hover:bg-surface-soft"
          onClick={() => {
            setOpen(false);
            onHide();
          }}
        >
          <span style={{ color: "var(--text-tertiary)" }}>
            <HideIcon />
          </span>
          Hide from catalog
        </button>
      ) : null}
      <button
        type="button"
        role="menuitem"
        disabled={deleteDisabled}
        title={deleteDisabled ? deleteDisabledReason : undefined}
        aria-disabled={deleteDisabled}
        className="flex w-full items-center gap-2.5 border-none bg-transparent px-3 py-2 text-left text-[13px] font-medium hover:bg-[color:var(--danger-bg)] disabled:cursor-not-allowed disabled:hover:bg-transparent"
        style={{
          color: deleteDisabled ? "var(--text-disabled, rgba(55,53,47,.35))" : "var(--danger-fg)",
          cursor: deleteDisabled ? "not-allowed" : "pointer",
        }}
        onClick={() => {
          if (deleteDisabled) return;
          setOpen(false);
          onDelete();
        }}
      >
        <DeleteIcon />
        Delete
      </button>
      {deleteDisabled && deleteDisabledReason ? (
        <p
          className="px-3 pb-2 pt-0.5 text-[11.5px] leading-snug"
          style={{ color: "var(--text-tertiary)" }}
        >
          {deleteDisabledReason}
        </p>
      ) : null}
    </div>
  ) : null;

  return (
    <div className="relative inline-flex justify-center">
      <button
        ref={triggerRef}
        type="button"
        aria-label={`Actions for ${programName}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((current) => !current)}
        className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-[8px] border-none bg-transparent transition-colors hover:bg-surface-soft"
        style={{ color: "var(--text-tertiary)" }}
      >
        <DotsIcon />
      </button>
      {mounted && menu ? createPortal(menu, document.body) : null}
    </div>
  );
}
