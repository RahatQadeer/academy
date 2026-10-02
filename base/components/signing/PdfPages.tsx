"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";

export type PageSize = { width: number; height: number };

/** Wide enough to read a contract's small print, narrow enough to leave the panel room. */
const MAX_PAGE_WIDTH = 880;

/**
 * The document, page by page, drawn with pdf.js.
 *
 * Each page is a canvas inside a positioned box, and the box is what the
 * signing screen drops onto: `renderOverlay` draws whatever has been placed on
 * a page inside that page's box, in its coordinates, so a signature scrolls
 * with the paper it is on.
 *
 * Pages are drawn at the width of the column they sit in and redrawn when it
 * changes. Nothing placed moves when that happens, because placements are kept
 * as fractions of the page rather than as pixels.
 */
export function PdfPages({
  url,
  pageRefs,
  onPages,
  renderOverlay,
  onPageClick,
  armed,
}: {
  url: string;
  pageRefs: React.MutableRefObject<(HTMLDivElement | null)[]>;
  onPages: (sizes: PageSize[]) => void;
  renderOverlay: (page: number) => ReactNode;
  onPageClick?: (page: number, event: React.MouseEvent<HTMLDivElement>) => void;
  /** Something is waiting to be put down, so the pages say where it can go. */
  armed?: boolean;
}) {
  const columnRef = useRef<HTMLDivElement>(null);
  const canvasRefs = useRef<(HTMLCanvasElement | null)[]>([]);
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [width, setWidth] = useState(0);
  const [sizes, setSizes] = useState<PageSize[]>([]);
  const [failed, setFailed] = useState(false);

  // Load once per document.
  useEffect(() => {
    let cancelled = false;
    let loaded: PDFDocumentProxy | null = null;

    (async () => {
      try {
        const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
        if (!pdfjs.GlobalWorkerOptions.workerSrc) {
          pdfjs.GlobalWorkerOptions.workerSrc = new URL(
            "pdfjs-dist/legacy/build/pdf.worker.min.mjs",
            import.meta.url,
          ).toString();
        }
        loaded = await pdfjs.getDocument({ url }).promise;
        if (cancelled) {
          void loaded.destroy();
          return;
        }
        setPdf(loaded);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();

    return () => {
      cancelled = true;
      if (loaded) void loaded.destroy();
    };
  }, [url]);

  // Follow the column's width, settled rather than on every frame of a resize.
  useEffect(() => {
    const column = columnRef.current;
    if (!column) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const measure = () => {
      const next = Math.min(MAX_PAGE_WIDTH, Math.floor(column.clientWidth));
      setWidth((current) => (Math.abs(current - next) > 4 ? next : current));
    };
    measure();
    const observer = new ResizeObserver(() => {
      clearTimeout(timer);
      timer = setTimeout(measure, 120);
    });
    observer.observe(column);
    return () => {
      clearTimeout(timer);
      observer.disconnect();
    };
  }, []);

  // Size every page first, so the whole document has its height before any of
  // it is drawn and the scroll position does not jump as pages arrive.
  useEffect(() => {
    if (!pdf || width <= 0) return;
    let cancelled = false;

    (async () => {
      const next: PageSize[] = [];
      for (let index = 1; index <= pdf.numPages; index += 1) {
        const page = await pdf.getPage(index);
        const base = page.getViewport({ scale: 1 });
        next.push({ width, height: Math.round((base.height / base.width) * width) });
      }
      if (cancelled) return;
      setSizes(next);
      onPages(next);
    })();

    return () => {
      cancelled = true;
    };
  }, [pdf, width, onPages]);

  // Then draw them, in order.
  useEffect(() => {
    if (!pdf || sizes.length === 0) return;
    let cancelled = false;
    const tasks: { cancel: () => void }[] = [];
    const ratio = Math.min(window.devicePixelRatio || 1, 2);

    (async () => {
      for (let index = 0; index < sizes.length; index += 1) {
        if (cancelled) return;
        const canvas = canvasRefs.current[index];
        if (!canvas) continue;
        const page = await pdf.getPage(index + 1);
        const base = page.getViewport({ scale: 1 });
        const viewport = page.getViewport({ scale: (sizes[index].width / base.width) * ratio });
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        const task = page.render({ canvas, viewport });
        tasks.push(task);
        try {
          await task.promise;
        } catch {
          // Cancelled by a resize; the next pass draws it.
        }
      }
    })();

    return () => {
      cancelled = true;
      tasks.forEach((task) => task.cancel());
    };
  }, [pdf, sizes]);

  if (failed) {
    return (
      <div
        className="mx-auto max-w-[520px] rounded-card border border-line-strong bg-surface p-6 text-[13.5px]"
        style={{ color: "var(--text-muted)" }}
      >
        This document could not be opened here. Use “Sign on paper” to download
        it, sign it, and send back the signed copy.
      </div>
    );
  }

  return (
    <div ref={columnRef} className="mx-auto flex w-full max-w-[880px] flex-col items-center gap-5">
      {!pdf || sizes.length === 0 ? (
        <div
          className="w-full rounded-card bg-surface"
          style={{ aspectRatio: "8.5 / 11", maxWidth: width || MAX_PAGE_WIDTH }}
          aria-busy="true"
          aria-label="Opening the document"
        />
      ) : (
        sizes.map((size, index) => (
          <div
            key={index}
            ref={(element) => {
              pageRefs.current[index] = element;
            }}
            data-page={index}
            onClick={onPageClick ? (event) => onPageClick(index, event) : undefined}
            className="relative shrink-0 bg-white shadow-[0_1px_3px_rgba(15,15,15,.12),0_6px_18px_rgba(15,15,15,.06)]"
            style={{ width: size.width, height: size.height, cursor: armed ? "copy" : undefined }}
          >
            <canvas
              ref={(element) => {
                canvasRefs.current[index] = element;
              }}
              aria-label={`Page ${index + 1} of ${sizes.length}`}
              className="block h-full w-full select-none"
            />
            {renderOverlay(index)}
            <span
              aria-hidden
              className="pointer-events-none absolute -bottom-[18px] right-0 text-[11px]"
              style={{ color: "var(--text-quiet)" }}
            >
              {index + 1} / {sizes.length}
            </span>
          </div>
        ))
      )}
    </div>
  );
}
