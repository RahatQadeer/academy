"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { needPlaceText, needWhen, type ClientNeed } from "@/whitbyos/lib/plan-requirements";
import { shortDate } from "@/whitbyos/lib/format";

/**
 * Why / Where / When behind an info mark — not printed under every row.
 *
 * Drawn into `document.body` so a parent with `overflow: hidden` cannot clip
 * the panel halfway through the When line.
 */
export function NeedInfo({ need }: { need: ClientNeed }) {
  const when = needWhen(need, need.dueBy ? shortDate(need.dueBy) : null);
  const lines: { label: string; text: string }[] = [
    ...(need.why ? [{ label: "Why", text: need.why }] : []),
    { label: "Where", text: needPlaceText(need.where) },
    ...(when ? [{ label: "When", text: when }] : []),
  ];

  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0, width: 320 });
  const panelId = useId();
  const button = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => setMounted(true), []);

  useLayoutEffect(() => {
    if (!open || !button.current) return;

    function place() {
      const mark = button.current;
      if (!mark) return;
      const box = mark.getBoundingClientRect();
      const width = Math.min(320, window.innerWidth - 24);
      let left = box.left;
      if (left + width > window.innerWidth - 12) {
        left = Math.max(12, window.innerWidth - width - 12);
      }
      const below = box.bottom + 8;
      const panelHeight = panel.current?.offsetHeight ?? 160;
      const top =
        below + panelHeight > window.innerHeight - 12
          ? Math.max(12, box.top - panelHeight - 8)
          : below;
      setPos({ top, left, width });
    }

    place();
    /* Second pass once the panel has real height. */
    requestAnimationFrame(place);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function away(event: MouseEvent) {
      const target = event.target as Node;
      if (button.current?.contains(target)) return;
      if (panel.current?.contains(target)) return;
      setOpen(false);
    }
    function escape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("mousedown", away);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);

  if (lines.length === 0) return null;

  return (
    <>
      <button
        ref={button}
        type="button"
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setOpen((was) => !was);
        }}
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={open ? "Hide why, where and when" : "Why, where and when"}
        title="Why, where and when"
        className="ml-1.5 inline-flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border-0 p-0 align-middle transition-colors"
        style={{
          color: open ? "var(--accent)" : "var(--text-quiet)",
          background: open ? "var(--accent-tint)" : "transparent",
        }}
      >
        <InfoMark />
      </button>

      {open && mounted
        ? createPortal(
            <div
              ref={panel}
              id={panelId}
              role="region"
              className="fixed z-[220] rounded-[10px] border px-3.5 py-3"
              style={{
                top: pos.top,
                left: pos.left,
                width: pos.width,
                background: "var(--surface)",
                borderColor: "var(--line)",
                boxShadow: "0 10px 32px rgba(15,15,15,.12)",
                color: "var(--ink)",
              }}
            >
              <div className="flex flex-col gap-2">
                {lines.map((line) => (
                  <p key={line.label} className="m-0 text-[12.5px] leading-[1.55]">
                    <span className="font-semibold" style={{ color: "var(--text-quiet)" }}>
                      {line.label}:
                    </span>{" "}
                    <span style={{ color: "var(--text-secondary)" }}>{line.text}</span>
                  </p>
                ))}
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

function InfoMark() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
      <circle cx="8" cy="8" r="6.25" stroke="currentColor" strokeWidth="1.4" />
      <path
        d="M8 7.2v4M8 5.1h.01"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
