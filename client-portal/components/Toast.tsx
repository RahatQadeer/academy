"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const DISMISS_MS = 5000;

/**
 * Confirmation for a completed server action, drawn the way Whitby draws its
 * own: a light card at the bottom right with a tick in its tone, not a dark
 * one-line pill.
 *
 * The pill was the shape Whitby reserves for one specific case — its
 * `DarkToast`, the export confirmation, which is a single sentence with a link
 * to a file beside it. Every toast in the portal was drawn that way, including
 * the ones reporting that something had been saved, which is the case the light
 * card exists for.
 *
 * Server actions redirect with `?toast=<message>`, so the toast survives the
 * redirect with no client state carried across the navigation. That param is
 * now cleared when the toast goes rather than left in the address bar: it used
 * to hide itself with local state only, so refreshing the page — or sharing the
 * URL — brought back a confirmation for something that had happened once,
 * minutes ago, or to somebody else.
 */
export function Toast({
  message,
  closeHref,
  detail,
  tone = "success",
}: {
  message: string;
  /**
   * This URL without `toast`, worked out on the server by `resolvePortalRoute`.
   *
   * Passed in rather than read here with `useSearchParams`, which would make
   * this component opt the page into client-side search params and need a
   * Suspense boundary around it at build time. The route table already has the
   * params in hand.
   */
  closeHref: string;
  detail?: string;
  tone?: "success" | "warning" | "danger";
}) {
  const router = useRouter();

  useEffect(() => {
    const timer = window.setTimeout(() => {
      router.replace(closeHref, { scroll: false });
    }, DISMISS_MS);
    return () => window.clearTimeout(timer);
  }, [closeHref, router]);

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
      aria-live="polite"
      className="fixed bottom-8 right-8 z-[60] flex w-[360px] max-w-[calc(100vw-32px)] items-start gap-3 rounded-[8px] border border-line bg-surface p-4"
      style={{ boxShadow: "0 12px 40px rgb(var(--shade-rgb) / .14)" }}
    >
      <div
        aria-hidden
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[12px] font-bold"
        style={{ background: BG[tone], color: FG[tone] }}
      >
        {MARK[tone]}
      </div>

      <div className="min-w-0 flex-1">
        <div className="text-[13.5px] font-semibold">{message}</div>
        {detail ? (
          <div className="mt-0.5 text-[12.5px]" style={{ color: "var(--text-muted)" }}>
            {detail}
          </div>
        ) : null}
      </div>

      <button
        type="button"
        aria-label="Dismiss"
        onClick={() => router.replace(closeHref, { scroll: false })}
        className="cursor-pointer text-[14px]"
        style={{ color: "var(--text-disabled)", background: "transparent", border: "none" }}
      >
        ✕
      </button>
    </div>
  );
}
