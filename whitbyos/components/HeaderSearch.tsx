"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { searchWorkspace } from "@/whitbyos/search-action";
import type { SearchHit } from "@/whitbyos/lib/search";

/**
 * The thing to offer to ask about, where the query is plainly its name.
 *
 * This was the first row of the first group, whatever it was: typing "ta"
 * matched the middle of "Whitfield Estate" and the line read "Ask Whitby about
 * Whitfield Estate" over six results about nothing of the kind — while the
 * link underneath still asked about "ta". The words promised a subject the
 * request did not carry.
 *
 * A word of the label has to start with what was typed. "Whit" is somebody
 * reaching for Whitfield Estate; "ta" is somebody two letters into a word they
 * have not finished, and the honest offer there is to ask about what they
 * actually typed.
 */
function subjectOf(query: string, label: string | undefined): string | undefined {
  const typed = query.trim().toLowerCase();
  if (!label || typed.length < 3) return undefined;

  return label
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .some((word) => word.startsWith(typed))
    ? label
    : undefined;
}

/**
 * Screens 1.0a and 1.0b, in the header rather than on Home.
 *
 * The export draws a 34px icon button that opens a box with the results
 * hanging off its bottom edge, squared where the two meet.
 */
const SCOPES = ["Clients", "Requests", "Tasks", "Documents"] as const;

export function HeaderSearch() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
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

  // Debounced, so typing a client's name is one query rather than eleven.
  // A plain effect with a cancellation flag rather than a transition: a
  // transition's pending flag never cleared here and the panel sat on
  // "Looking…" after the results had already arrived.
  useEffect(() => {
    if (!open || query.trim().length < 2) {
      setHits([]);
      setLooking(false);
      return;
    }

    let live = true;
    setLooking(true);

    const timer = setTimeout(() => {
      searchWorkspace(query)
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
  const grouped = SCOPES.map((scope) => ({
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
          aria-label="Search clients, requests, tasks and documents"
          onKeyDown={(event) => {
            if (event.key !== "Enter" || query.trim().length < 2 || looking) return;
            event.preventDefault();
            setOpen(false);
            router.push(
              hits[0]
                ? hits[0].href
                : `/whitbyos/ask?q=${encodeURIComponent(query.trim())}`,
            );
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
        aria-label="Search clients, requests, tasks and documents"
        aria-expanded={open}
        title="Search"
        className="pa-bar-btn relative"
      >
        {/* Drawn rather than a glyph, which is how the export makes it. */}
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
          style={{ boxShadow: "0 8px 24px rgba(15,15,15,.12)" }}
        >
          {hits.length === 0 ? (
            looking ? (
              <div className="px-2 py-4 text-center text-[12.5px]" style={{ color: "var(--text-tertiary)" }}>
                Looking…
              </div>
            ) : (
              <div className="px-2 py-3 text-center">
                <div className="mb-1 text-[13px] font-semibold">
                  No results for &ldquo;{query}&rdquo;
                </div>
                <div className="mb-3 text-[12px] leading-[1.5]" style={{ color: "var(--text-soft)" }}>
                  Check the spelling, or try just a client&apos;s last name.
                </div>

                <div className="mb-3 flex flex-wrap justify-center gap-1.5">
                  {SCOPES.map((scope) => (
                    <span
                      key={scope}
                      className="rounded px-2 py-[3px] text-[11px]"
                      style={{ background: "var(--canvas)", color: "var(--text-muted)" }}
                    >
                      {scope}
                    </span>
                  ))}
                </div>

                {/* 1.0b puts this above the button: the offer is that Whitby
                    looks wider than the four scopes that just found nothing. */}
                <div className="mb-2.5 flex items-start gap-2 text-left">
                  <span
                    className="mt-px flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-[6px] text-[9px] font-bold text-white"
                    style={{ background: "var(--ink)" }}
                    aria-hidden
                  >
                    W
                  </span>
                  <span
                    className="text-[12px] leading-[1.5]"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    Can&apos;t find it? Ask Whitby to look across everything for you.
                  </span>
                </div>

                <AskWhitbyLink query={query} onGo={() => setOpen(false)} filled />
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
                        <span className="block truncate text-[13px] font-medium">{hit.label}</span>
                        {/* Nothing sets `detail` yet — see the note on
                            `SearchHit`. Rendered only when there is one, so a
                            row is short rather than carrying a blank line
                            under every name. */}
                        {hit.detail ? (
                          <span className="block truncate text-[11.5px]" style={{ color: "var(--text-tertiary)" }}>
                            {hit.detail}
                          </span>
                        ) : null}
                      </span>
                    </Link>
                  ))}
                </div>
              ))}

              {/* 1.0a keeps Ask Whitby under the hits, so a name that matched
                  still has a way into the things this box does not search. */}
              <div className="mt-1.5 border-t border-line px-2 pb-1 pt-2.5">
                <AskWhitbyLink
                  query={query}
                  subject={subjectOf(query, grouped[0]?.rows[0]?.label)}
                  onGo={() => setOpen(false)}
                />
              </div>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

/** 1.0a and 1.0b's way into Ask Whitby from the same words that were typed. */
function AskWhitbyLink({
  query,
  subject,
  onGo,
  filled,
}: {
  query: string;
  /**
   * What the search actually found, when it found something. 1.0a offers "Ask
   * Whitby about Whitfield Estate →" rather than repeating the letters typed:
   * by then the search has worked out which thing was meant, and the offer
   * reads as being about that thing.
   */
  subject?: string;
  onGo: () => void;
  filled?: boolean;
}) {
  return (
    <Link
      href={`/whitbyos/ask?q=${encodeURIComponent(subject ?? query.trim())}`}
      onClick={onGo}
      className={
        filled
          ? "flex items-center justify-center rounded-control px-3 py-2 text-[13px] font-medium text-white no-underline hover:text-white"
          : "flex items-center gap-2 no-underline"
      }
      style={filled ? { background: "var(--accent)", color: "#fff" } : { color: "var(--accent)" }}
    >
      {filled ? null : (
        <span
          className="flex h-[20px] w-[20px] shrink-0 items-center justify-center rounded-[5px] text-[8px] font-bold text-white"
          style={{ background: "var(--ink)" }}
          aria-hidden
        >
          W
        </span>
      )}
      <span className="text-[12.5px]">
        {subject ? (
          <>Ask Whitby about {subject} →</>
        ) : (
          <>Ask Whitby about &ldquo;{query.trim()}&rdquo;</>
        )}
      </span>
    </Link>
  );
}
