"use client";

/**
 * 15.3's "Download PDF", the same way WP.24 does it.
 *
 * The browser already turns this page into a PDF, and it keeps the text as
 * text. The print stylesheet drops the nav rail and the header, so what comes
 * out is the report and not a screenshot of the application around it.
 *
 * Only the open view prints, which is the honest behaviour: Charts, Kanban and
 * Timeline are three ways of reading the same figures, and printing all three
 * onto one sheet would be a document nobody asked for.
 */
export function DownloadReport() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="rounded-control border px-3.5 py-[7px] text-[13px] font-medium"
      style={{
        background: "var(--surface)",
        borderColor: "var(--border-strong)",
        color: "var(--ink)",
      }}
    >
      Download PDF
    </button>
  );
}
