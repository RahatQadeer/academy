"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/base/components/Button";
import { catalogAdminStatusLabel } from "@/academy/admin/lib/programDeletion";
import type { AcademyPublishRequestStatus } from "@/academy/lib/domain";
import { programStatusLabel, publishRequestLabel } from "@/academy/instructor/utils/labels";

type Tab = "build" | "preview" | "settings";

export function CourseBuilderTopBar({
  programName,
  status,
  activeTab,
  isPublished,
  onTabChange,
  onSave,
  saving,
  onPublish,
  onUnpublish,
  onRevert,
  reverting,
  publishing,
  hasChanges = true,
  hasUnpublishedChanges = false,
  chatOpen,
  onToggleChat,
  outlineOpen,
  onToggleOutline,
  enrollmentCount = 0,
  backHref = "/academy/admin/programs",
  surface = "admin",
  requestStatus = null,
  canPublishWithoutApproval = false,
}: {
  programName: string;
  status: "draft" | "pending_approval" | "published";
  activeTab?: Tab;
  programId?: string;
  isPublished?: boolean;
  onTabChange?: (tab: Tab) => void;
  onSave?: () => void;
  saving?: boolean;
  publishing?: boolean;
  hasChanges?: boolean;
  hasUnpublishedChanges?: boolean;
  onPublish?: () => void;
  onUnpublish?: () => void;
  onRevert?: () => void;
  reverting?: boolean;
  chatOpen?: boolean;
  onToggleChat?: () => void;
  outlineOpen?: boolean;
  onToggleOutline?: () => void;
  enrollmentCount?: number;
  backHref?: string;
  surface?: "admin" | "instructor";
  requestStatus?: AcademyPublishRequestStatus | null;
  canPublishWithoutApproval?: boolean;
}) {
  const instructor = surface === "instructor";
  const statusLabel = instructor
    ? programStatusLabel(status)
    : catalogAdminStatusLabel(status, enrollmentCount);

  const liveClean =
    Boolean(isPublished) && !hasChanges && !hasUnpublishedChanges;

  const waitingFirstPublish =
    instructor &&
    !isPublished &&
    !canPublishWithoutApproval &&
    (requestStatus === "pending" || (status === "pending_approval" && requestStatus !== "approved"));

  const waitingRepublish =
    instructor &&
    Boolean(isPublished) &&
    !canPublishWithoutApproval &&
    requestStatus === "pending" &&
    (hasUnpublishedChanges || hasChanges);

  const waiting = waitingFirstPublish || waitingRepublish;

  const canPublishAfterApproval =
    instructor &&
    !canPublishWithoutApproval &&
    requestStatus === "approved" &&
    !hasChanges &&
    (!isPublished || hasUnpublishedChanges);

  const canPublishDirect =
    instructor &&
    canPublishWithoutApproval &&
    !hasChanges &&
    (!isPublished || hasUnpublishedChanges);

  const canPublishNow = canPublishDirect || canPublishAfterApproval;

  // Show approval badge only while it still affects what the instructor should do.
  const showRequestStatus =
    instructor &&
    Boolean(requestStatus) &&
    !canPublishWithoutApproval &&
    !liveClean &&
    (requestStatus === "pending" ||
      requestStatus === "rejected" ||
      (requestStatus === "approved" && (!isPublished || hasUnpublishedChanges || hasChanges)));

  let primaryLabel: string;
  if (instructor) {
    if (liveClean) primaryLabel = "Live in Explore";
    else if (waiting) primaryLabel = "Waiting for review";
    else if (canPublishWithoutApproval) {
      primaryLabel = publishing ? "Publishing…" : isPublished ? "Publish changes" : "Publish";
    } else if (canPublishNow) {
      primaryLabel = publishing ? "Publishing…" : isPublished ? "Publish changes" : "Publish";
    } else {
      primaryLabel = publishing ? "Submitting…" : "Submit for approval";
    }
  } else if (isPublished) {
    primaryLabel = publishing ? "Publishing…" : "Publish changes";
  } else {
    primaryLabel = publishing ? "Publishing…" : "Publish";
  }

  const adminPublishDisabled = publishing || reverting || (!hasChanges && !hasUnpublishedChanges);
  const instructorButtonDisabled = publishing || reverting || waiting || liveClean;
  const busy = Boolean(saving || publishing || reverting);
  const canRevert = Boolean(isPublished && onRevert && (hasUnpublishedChanges || hasChanges));

  const overflowItems: OverflowItem[] = [];
  if (onToggleChat) {
    overflowItems.push({
      label: chatOpen ? "Hide Whitby" : "Show Whitby",
      onSelect: onToggleChat,
    });
  }
  if (onRevert) {
    overflowItems.push({
      label: reverting ? "Reverting…" : "Revert",
      onSelect: onRevert,
      disabled: busy || !canRevert,
      hint: canRevert ? "Discard edits and restore the live published course" : "Nothing to revert",
    });
  }
  if (onSave) {
    overflowItems.push({
      label: saving ? "Saving…" : "Save",
      onSelect: onSave,
      disabled: busy || !hasChanges,
      hint: hasChanges ? "Save for later publish" : "No changes to save",
    });
  }
  if (onUnpublish) {
    overflowItems.push({
      label: publishing ? "Hiding…" : "Hide from catalog",
      onSelect: onUnpublish,
      disabled: busy,
      hint: "Hide this course from Explore",
    });
  }

  return (
    <header
      className="sticky top-0 z-50 shrink-0 border-b"
      style={{ background: "var(--surface)", borderColor: "var(--border)" }}
    >
      <div className="flex h-14 items-center gap-2 px-3 sm:gap-3 sm:px-5">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <Link
            href={backHref}
            aria-label="Back to programs"
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[6px] no-underline hover:bg-black/[0.04]"
            style={{ color: "var(--text-secondary)" }}
          >
            <BackChevron />
          </Link>

          <p
            className="min-w-0 truncate text-[13px] font-semibold leading-none tracking-[-0.01em] sm:text-[13.5px]"
            style={{ color: "var(--ink)" }}
            title={programName}
          >
            {programName.trim() || "Untitled program"}
          </p>

          <span
            className="hidden shrink-0 items-center gap-1.5 whitespace-nowrap text-[11.5px] lg:inline-flex"
            style={{ color: "var(--text-tertiary)" }}
          >
            <span>{instructor ? "Program" : "Catalog"}</span>
            <span aria-hidden>·</span>
            <span style={{ color: status === "published" ? "#1c7a52" : "var(--text-secondary)" }}>
              {statusLabel}
            </span>
            {instructor && canPublishWithoutApproval ? (
              <>
                <span aria-hidden>·</span>
                <span style={{ color: "var(--success-fg)" }}>Direct publish</span>
              </>
            ) : null}
            {showRequestStatus ? (
              <>
                <span aria-hidden>·</span>
                <span>{publishRequestLabel(requestStatus!)}</span>
              </>
            ) : null}
          </span>
        </div>

        {onTabChange ? (
          <nav
            className="hidden shrink-0 rounded-[8px] border p-0.5 lg:inline-flex"
            style={{ borderColor: "var(--border-strong)", background: "var(--surface-soft)" }}
          >
            {(["build", "preview", "settings"] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => onTabChange(tab)}
                className="rounded-[6px] px-3 py-1.5 text-[12.5px] font-medium"
                style={{
                  color: activeTab === tab ? "var(--ink)" : "var(--text-tertiary)",
                  background: activeTab === tab ? "var(--surface)" : "transparent",
                  border: activeTab === tab ? "1px solid var(--border)" : "1px solid transparent",
                  boxShadow: activeTab === tab ? "0 1px 2px rgba(15,15,15,.04)" : "none",
                }}
              >
                {tab === "build" ? "Build" : tab === "preview" ? "Preview" : "Settings"}
              </button>
            ))}
          </nav>
        ) : null}

        <div className="flex shrink-0 items-center gap-1">
          {onToggleOutline ? (
            <button
              type="button"
              onClick={onToggleOutline}
              aria-label={outlineOpen ? "Hide outline" : "Show outline"}
              aria-pressed={outlineOpen}
              title={outlineOpen ? "Hide outline" : "Show outline"}
              className="inline-flex h-8 w-8 items-center justify-center rounded-[8px] border hover:bg-black/[0.03] md:hidden"
              style={{
                borderColor: outlineOpen ? "var(--accent)" : "var(--border)",
                color: outlineOpen ? "var(--accent)" : "var(--text-secondary)",
                background: outlineOpen ? "var(--accent-tint)" : "transparent",
              }}
            >
              <OutlineIcon />
            </button>
          ) : null}

          {overflowItems.length > 0 ? <OverflowMenu items={overflowItems} /> : null}

          {instructor ? (
            <Button
              variant={waiting || liveClean ? "secondary" : "primary"}
              className="!max-w-[9.25rem] !truncate !px-2.5 !py-1.5 !text-[12px] sm:!max-w-none sm:!px-3 sm:!text-[12.5px]"
              onClick={onPublish}
              disabled={instructorButtonDisabled}
              title={
                liveClean
                  ? "This course is live. Edit and save to submit changes for approval."
                  : waiting
                    ? "Waiting for an Academy Admin to review"
                    : undefined
              }
            >
              {primaryLabel}
            </Button>
          ) : isPublished ? (
            <Button
              variant="primary"
              className="!max-w-[9.25rem] !truncate !px-2.5 !py-1.5 !text-[12px] sm:!max-w-none sm:!px-3 sm:!text-[12.5px]"
              onClick={onPublish}
              disabled={adminPublishDisabled}
              title={adminPublishDisabled ? "No unpublished edits to publish" : undefined}
            >
              {primaryLabel}
            </Button>
          ) : (
            <Button
              variant="primary"
              className="!max-w-[9.25rem] !truncate !px-2.5 !py-1.5 !text-[12px] sm:!max-w-none sm:!px-3 sm:!text-[12.5px]"
              onClick={onPublish}
              disabled={publishing}
            >
              {primaryLabel}
            </Button>
          )}
        </div>
      </div>

      {onTabChange ? (
        <nav
          className="flex gap-1 border-t px-2 py-1.5 lg:hidden"
          style={{ borderColor: "var(--border)", background: "var(--surface-soft)" }}
        >
          {(["build", "preview", "settings"] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => onTabChange(tab)}
              className="min-w-0 flex-1 rounded-[7px] px-2 py-1.5 text-[12.5px] font-medium"
              style={{
                color: activeTab === tab ? "var(--ink)" : "var(--text-tertiary)",
                background: activeTab === tab ? "var(--surface)" : "transparent",
                border: activeTab === tab ? "1px solid var(--border)" : "1px solid transparent",
                boxShadow: activeTab === tab ? "0 1px 2px rgba(15,15,15,.04)" : "none",
              }}
            >
              {tab === "build" ? "Build" : tab === "preview" ? "Preview" : "Settings"}
            </button>
          ))}
        </nav>
      ) : null}
    </header>
  );
}

type OverflowItem = {
  label: string;
  onSelect: () => void;
  disabled?: boolean;
  hint?: string;
};

function OverflowMenu({ items }: { items: OverflowItem[] }) {
  const menuId = useId();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function onPointer(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    window.addEventListener("mousedown", onPointer);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onPointer);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-label="More actions"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((current) => !current)}
        className="inline-flex h-8 w-8 items-center justify-center rounded-[8px] border hover:bg-black/[0.03]"
        style={{
          color: "var(--text-secondary)",
          borderColor: open ? "var(--border-strong)" : "var(--border)",
          background: open ? "var(--surface-soft)" : "var(--surface)",
        }}
      >
        <DotsIcon />
      </button>

      {open ? (
        <div
          id={menuId}
          role="menu"
          className="absolute right-0 z-30 mt-1.5 w-[220px] rounded-[10px] border py-1"
          style={{
            borderColor: "var(--border)",
            background: "var(--surface)",
            boxShadow: "0 8px 24px rgba(15,15,15,.1), 0 1px 2px rgba(15,15,15,.06)",
          }}
        >
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              disabled={item.disabled}
              title={item.hint}
              onClick={() => {
                if (item.disabled) return;
                setOpen(false);
                item.onSelect();
              }}
              className="block w-full cursor-pointer px-3 py-2 text-left text-[13px] font-medium disabled:cursor-not-allowed disabled:opacity-35"
              style={{
                color: "var(--ink)",
                background: "transparent",
                border: "none",
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function BackChevron() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M10 3.5L5.5 8 10 12.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function OutlineIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M3 4h10M3 8h10M3 12h6"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function DotsIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <circle cx="3.5" cy="8" r="1.2" fill="currentColor" />
      <circle cx="8" cy="8" r="1.2" fill="currentColor" />
      <circle cx="12.5" cy="8" r="1.2" fill="currentColor" />
    </svg>
  );
}
