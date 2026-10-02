"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { searchPortalAction } from "@/client-portal/search-action";
import {
  PORTAL_SEARCH_SCOPES,
  type PortalSearchHit,
} from "@/client-portal/lib/search-vocab";

/**
 * Search, in the portal's header, drawn the way Whitby draws its own: a bar
 * button that opens a box with the results hanging off its bottom edge,
 * squared where the two meet.
 *
 * `pa-bar-btn` rather than a hand-written 34px square. The class is what every
 * other control on either product's bar is drawn with — one size, one radius,
 * one hover — and this was the last copy of the older, smaller shape, so the
 * portal's search sat 2px short of its own bell.
 *
 * The portal had no search of any kind. That was tenable when a client's whole
 * account was a handful of rows and stops being so in the first year: finding
 * the insurance form meant remembering whether it was a Form or a Document and
 * then scrolling the right list. The four scopes are the four areas that hold a
 * list long enough to lose something in.
 */
export function HeaderSearch() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<PortalSearchHit[]>([]);
  const [looking, setLooking] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function away(event: MouseEvent) {
      if (!box.current?.contains(event.target as Node)) setOpen(false);
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

  // Debounced, so typing a request's name is one call rather than eleven.
  useEffect(() => {
    if (!open || query.trim().length < 2) {
      setHits([]);
      setLooking(false);
      return;
    }

    let live = true;
    setLooking(true);

    const timer = setTimeout(() => {
      searchPortalAction(query)
        .then((found) => {
          if (!live) return;
          setHits(found);
          setLooking(false);
        })
        .catch(() => {
          if (live) setLooking(false);
        });
    }, 220);

    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [query, open]);

  const searched = query.trim().length >= 2;
  const grouped = PORTAL_SEARCH_SCOPES.map((scope) => ({
    scope,
    rows: hits.filter((hit) => `${hit.kind}s` === scope),
  })).filter((group) => group.rows.length > 0);

  return (
    <div ref={box} className="relative flex items-center gap-2">
      {open ? (
        <input
          autoFocus
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search…"
          aria-label="Search requests, forms, documents and messages"
          onKeyDown={(event) => {
            if (event.key !== "Enter" || !hits[0] || looking) return;
            event.preventDefault();
            setOpen(false);
            router.push(hits[0].href);
          }}
          className={`h-[36px] w-[230px] border bg-surface px-3 text-[13.5px] ${
            searched
              ? "rounded-t-control rounded-b-none border-accent"
              : "rounded-control border-line-strong"
          }`}
        />
      ) : null}

      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label="Search requests, forms, documents and messages"
        aria-expanded={open}
        title="Search"
        className="pa-bar-btn relative"
      >
        {/* Drawn rather than a glyph, the way Whitby's is. */}
        <span
          className="block h-[11px] w-[11px] rounded-full"
          style={{ border: "1.5px solid currentColor" }}
        />
        <span
          className="absolute bottom-[10px] right-[9px] block h-[1.5px] w-[6px] rotate-45 rounded-[1px]"
          style={{ background: "currentColor" }}
        />
      </button>

      {open && searched ? (
        <div
          className="absolute right-[44px] top-[40px] z-30 w-[360px] overflow-hidden rounded-b-[10px] border border-line-strong bg-surface p-2.5"
          style={{ boxShadow: "0 8px 24px rgb(var(--shade-rgb) / .12)" }}
        >
          {hits.length === 0 ? (
            looking ? (
              <div
                className="px-2 py-4 text-center text-[12.5px]"
                style={{ color: "var(--text-tertiary)" }}
              >
                Looking…
              </div>
            ) : (
              <div className="px-2 py-3 text-center">
                <div className="mb-1 text-[13px] font-semibold">
                  No results for &ldquo;{query}&rdquo;
                </div>
                <div
                  className="mb-3 text-[12px] leading-[1.5]"
                  style={{ color: "var(--text-soft)" }}
                >
                  Check the spelling, or try a word from the title.
                </div>

                <div className="flex flex-wrap justify-center gap-1.5">
                  {PORTAL_SEARCH_SCOPES.map((scope) => (
                    <span
                      key={scope}
                      className="rounded px-2 py-[3px] text-[11px]"
                      style={{ background: "var(--canvas)", color: "var(--text-muted)" }}
                    >
                      {scope}
                    </span>
                  ))}
                </div>
              </div>
            )
          ) : (
            <div className="flex max-h-[420px] flex-col overflow-y-auto">
              {grouped.map((group) => (
                <div key={group.scope}>
                  <div
                    className="px-2 pb-1 pt-2 text-[10.5px] font-semibold uppercase tracking-[0.04em]"
                    style={{ color: "var(--text-faint)" }}
                  >
                    {group.scope}
                  </div>
                  {group.rows.map((hit) => (
                    <Link
                      key={`${hit.kind}-${hit.id}`}
                      href={hit.href}
                      onClick={() => setOpen(false)}
                      className="flex items-start gap-2.5 rounded-control px-2 py-1.5 no-underline hover:bg-[var(--surface-soft)]"
                      style={{ color: "var(--ink)" }}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-medium">
                          {hit.label}
                        </span>
                        {hit.detail ? (
                          <span
                            className="block truncate text-[11.5px]"
                            style={{ color: "var(--text-tertiary)" }}
                          >
                            {hit.detail}
                          </span>
                        ) : null}
                      </span>
                    </Link>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
