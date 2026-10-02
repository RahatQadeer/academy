"use client";

import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { deleteAskThread, renameAskThread } from "@/whitbyos/ask/actions";
import { askThreadLabel } from "@/whitbyos/lib/ask-format";

/** Solid dark ··· menu (Rename + Delete). Not glass. Page stays light. */
export function AskChatMenu({
  threadId,
  title,
  align = "right",
  onDeleted,
  onRenamed,
  triggerClassName,
}: {
  threadId: string;
  title: string;
  align?: "left" | "right";
  onDeleted?: (threadId: string) => void;
  onRenamed?: (threadId: string, title: string) => void;
  triggerClassName?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState(askThreadLabel(title));
  const [, startTransition] = useTransition();
  const box = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open && !renaming) return;
    const away = (event: MouseEvent) => {
      if (!box.current?.contains(event.target as Node)) {
        setOpen(false);
        setRenaming(false);
      }
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        setRenaming(false);
      }
    };
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("mousedown", away);
      document.removeEventListener("keydown", escape);
    };
  }, [open, renaming]);

  useEffect(() => {
    if (!renaming) return;
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [renaming]);

  function saveRename() {
    const next = draft.trim();
    if (!next || next === askThreadLabel(title)) {
      setRenaming(false);
      setOpen(false);
      return;
    }
    onRenamed?.(threadId, next);
    setRenaming(false);
    setOpen(false);
    startTransition(async () => {
      await renameAskThread(threadId, next);
      router.refresh();
    });
  }

  return (
    <div ref={box} className="relative shrink-0">
      <button
        type="button"
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setOpen((was) => !was);
          setRenaming(false);
          setDraft(askThreadLabel(title));
        }}
        aria-label="Chat options"
        aria-haspopup="menu"
        aria-expanded={open}
        className={
          triggerClassName ??
          "ask-recent-menu flex h-7 w-7 items-center justify-center rounded-[6px]"
        }
        data-open={open || renaming ? "1" : undefined}
      >
        <MoreIcon />
      </button>

      {open && !renaming ? (
        <div
          role="menu"
          className={`ask-glass-menu absolute top-[calc(100%+6px)] z-40 w-[200px] overflow-hidden py-1.5 ${
            align === "left" ? "left-0" : "right-0"
          }`}
        >
          <MenuItem
            icon={<RenameIcon />}
            label="Rename"
            onClick={() => {
              setDraft(askThreadLabel(title));
              setRenaming(true);
            }}
          />
          <div className="ask-glass-menu-rule" />
          <MenuItem
            icon={<TrashIcon />}
            label="Delete"
            danger
            onClick={() => {
              setOpen(false);
              onDeleted?.(threadId);
              startTransition(async () => {
                await deleteAskThread(threadId);
              });
            }}
          />
        </div>
      ) : null}

      {renaming ? (
        <div
          className={`ask-glass-menu absolute top-[calc(100%+6px)] z-40 w-[240px] overflow-hidden p-2.5 ${
            align === "left" ? "left-0" : "right-0"
          }`}
        >
          <p className="ask-glass-menu-label mb-1.5 px-0.5">Rename chat</p>
          <input
            ref={inputRef}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                saveRename();
              }
            }}
            maxLength={80}
            className="ask-glass-menu-input w-full"
            aria-label="Chat name"
          />
          <div className="mt-2 flex justify-end gap-1.5">
            <button
              type="button"
              className="ask-glass-menu-btn"
              onClick={() => {
                setRenaming(false);
                setOpen(false);
              }}
            >
              Cancel
            </button>
            <button type="button" className="ask-glass-menu-btn is-primary" onClick={saveRename}>
              Save
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function MenuItem({
  icon,
  label,
  onClick,
  danger,
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      className={`ask-glass-menu-item${danger ? " is-danger" : ""}`}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onClick();
      }}
    >
      <span className="ask-glass-menu-icon" aria-hidden>
        {icon}
      </span>
      {label}
    </button>
  );
}

function MoreIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <circle cx="3.5" cy="8" r="1.35" fill="currentColor" />
      <circle cx="8" cy="8" r="1.35" fill="currentColor" />
      <circle cx="12.5" cy="8" r="1.35" fill="currentColor" />
    </svg>
  );
}

function RenameIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M9.2 3.4 12.6 6.8M3 13l.7-3.2L10.8 2.7a1.4 1.4 0 0 1 2 0l.5.5a1.4 1.4 0 0 1 0 2L6.2 12.3 3 13Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M3.5 4.5h9M6 4.5V3.2h4v1.3M5.2 4.5l.5 8.2h4.6l.5-8.2"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
