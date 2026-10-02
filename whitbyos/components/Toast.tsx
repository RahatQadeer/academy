"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/base/lib/cn";

const DISMISS_MS = 4000;

function useAutoDismiss(closeHref: string) {
  const router = useRouter();

  useEffect(() => {
    const timer = window.setTimeout(() => {
      router.replace(closeHref, { scroll: false });
    }, DISMISS_MS);
    return () => window.clearTimeout(timer);
  }, [closeHref, router]);

  return () => router.replace(closeHref, { scroll: false });
}

/**
 * The bottom-right confirmation the reference shows after an action lands
 * (7.1.1 and its siblings).
 *
 * It still lives in the URL like Whitby's dialogs, so refresh keeps it honest.
 * ✕ clears that immediately; otherwise it goes on its own after a few seconds.
 */
export function Toast({
  title,
  detail,
  closeHref,
  action,
  tone = "success",
}: {
  title: string;
  detail?: string;
  closeHref: string;
  /** For a toast that reports a half-success and leaves something to do. */
  action?: React.ReactNode;
  tone?: "success" | "warning" | "danger";
}) {
  const dismiss = useAutoDismiss(closeHref);

  // Warning is its own thing rather than a softer danger: the action worked,
  // and only part of what was expected to follow it did.
  const MARK = { success: "✓", warning: "!", danger: "!" } as const;
  const BG = {
    success: "var(--success-bg)",
    warning: "var(--warning-bg)",
    danger: "var(--danger-bg)",
  } as const;
  const FG = {
    success: "var(--success-fg)",
    warning: "var(--warning-fg)",
    danger: "var(--danger-fg)",
  } as const;

  return (
    <div
      role="status"
      className="fixed bottom-8 right-8 z-50 flex w-[360px] items-start gap-3 rounded-[8px] border border-line bg-surface p-4"
      style={{ boxShadow: "0 12px 40px rgba(15,15,15,.14)" }}
    >
      <div
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[12px] font-bold"
        style={{ background: BG[tone], color: FG[tone] }}
      >
        {MARK[tone]}
      </div>

      <div className="flex-1">
        <div className="text-[13.5px] font-semibold">{title}</div>
        {detail ? (
          <div className="mt-0.5 text-[12.5px]" style={{ color: "var(--text-muted)" }}>
            {detail}
          </div>
        ) : null}
        {action ? <div className="mt-2.5 flex gap-2">{action}</div> : null}
      </div>

      <button
        type="button"
        aria-label="Dismiss"
        onClick={dismiss}
        className="cursor-pointer text-[14px]"
        style={{ color: "var(--text-disabled)", background: "transparent", border: "none" }}
      >
        ✕
      </button>
    </div>
  );
}

/**
 * The export confirmation (2.1.6), which the export draws quite differently
 * from the others: dark, top right, one line, with the link to the file beside
 * the words rather than under them.
 */
export function DarkToast({
  message,
  actionLabel,
  actionHref,
  closeHref,
  placement = "top-right",
  mark = true,
}: {
  message: string;
  actionLabel?: string;
  actionHref?: string;
  closeHref: string;
  /**
   * 2.1.6 draws it top right; WP.23 draws the same toast centred along the
   * bottom. The reference varies this per screen rather than per design
   * system, so it is said here rather than quietly normalised.
   */
  placement?: "top-right" | "bottom-center";
  /** WP.23 carries the words alone, with no tick before them. */
  mark?: boolean;
}) {
  const dismiss = useAutoDismiss(closeHref);

  return (
    <div
      role="status"
      className={cn(
        "fixed z-50 flex items-center rounded-[8px] text-white",
        placement === "top-right"
          ? "right-5 top-5 gap-2.5 px-4 py-3 text-[13px]"
          : "bottom-7 left-1/2 -translate-x-1/2 gap-4 px-[18px] py-[13px] text-[13.5px]",
      )}
      style={{ background: "var(--ink)", boxShadow: "0 8px 24px rgba(15,15,15,.25)" }}
    >
      {mark ? (
        <span style={{ color: "#7ee2a8" }} aria-hidden>
          ✓
        </span>
      ) : null}
      {message}
      {actionHref && actionLabel ? (
        <a
          href={actionHref}
          target="_blank"
          rel="noreferrer"
          className="ml-1.5 font-medium no-underline"
          style={{ color: "#8ec9ff" }}
        >
          {actionLabel}
        </a>
      ) : null}
      <button
        type="button"
        aria-label="Dismiss"
        onClick={dismiss}
        className="ml-1 cursor-pointer"
        style={{ color: "rgba(255,255,255,.5)", background: "transparent", border: "none" }}
      >
        ✕
      </button>
    </div>
  );
}
