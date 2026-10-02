"use client";

/**
 * Paper, not a file.
 *
 * This used to say "Download PDF" beside the link that actually downloads
 * one, so the bar offered the same words twice for two different things: one
 * fetched the rendered document, the other opened the browser's print sheet.
 * It says what it does now, and the download beside it is the only Download.
 */
export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="rounded-control border border-line-strong px-4 py-[9px] text-[13.5px] font-medium"
      style={{ color: "var(--ink)" }}
    >
      Print
    </button>
  );
}
