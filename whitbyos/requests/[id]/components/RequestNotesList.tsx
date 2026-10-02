"use client";

import { useMemo, useState } from "react";
import { Avatar } from "@/base/components/Avatar";
import { Pill } from "@/base/components/Pill";
import { ShowMore } from "@/whitbyos/components/ShowMore";
import { relativeTime, shortDate } from "@/whitbyos/lib/format";
import type { RequestNote } from "@/whitbyos/lib/request-detail";

/**
 * Live filter as you type — same idea as the Tasks search on this Request.
 */
export function RequestNotesList({ notes }: { notes: RequestNote[] }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return notes;
    return notes.filter((note) => {
      const hay = [note.body, note.authorName ?? "", note.visibility]
        .join(" ")
        .toLowerCase();
      return hay.includes(needle);
    });
  }, [notes, query]);

  return (
    <div className="w-full">
      <div
        className="mb-3.5 flex w-full max-w-[420px] items-center gap-2 rounded-[10px] border py-[7px] pl-3.5 pr-2.5 transition-[border-color,box-shadow] focus-within:border-[var(--accent)] focus-within:shadow-[0_0_0_3px_color-mix(in_srgb,var(--accent)_18%,transparent)]"
        style={{
          borderColor: "color-mix(in srgb, var(--chrome-line) 70%, #c5ced8)",
          background: "var(--surface)",
          boxShadow: "0 1px 2px rgba(31,72,125,.04)",
        }}
      >
        <span
          aria-hidden
          className="pointer-events-none shrink-0"
          style={{ color: "var(--text-quiet)" }}
        >
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
            <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.5" />
            <path
              d="M10.5 10.5L14 14"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </span>
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search notes…"
          aria-label="Search notes"
          className="min-w-0 flex-1 border-none bg-transparent py-1 text-[13.5px] outline-none placeholder:text-[rgba(55,53,47,0.38)] [&::-webkit-search-cancel-button]:hidden"
          style={{ color: "var(--ink)", caretColor: "var(--ink)" }}
        />
        {query ? (
          <button
            type="button"
            onClick={() => setQuery("")}
            aria-label="Clear search"
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-[var(--surface-soft)]"
            style={{ color: "var(--text-tertiary)" }}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
              <path
                d="M3 3l6 6M9 3L3 9"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </button>
        ) : null}
      </div>

      {filtered.length === 0 ? (
        <div
          className="rounded-[12px] border px-6 py-10 text-center text-[13.5px]"
          style={{
            borderColor: "color-mix(in srgb, var(--chrome-line) 85%, #c5ced8)",
            background: "var(--surface)",
            color: "var(--text-tertiary)",
          }}
        >
          {query.trim()
            ? `No notes match “${query.trim()}”.`
            : "Nothing written down yet. Notes are what the next person needs to know and would otherwise have to ask for."}
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          <ShowMore step={8}>
            {filtered.map((note) => (
              <article
                key={note.id}
                className="rounded-[12px] border px-4 py-3.5"
                style={{
                  borderColor: "color-mix(in srgb, var(--chrome-line) 85%, #c5ced8)",
                  background: "var(--surface)",
                  boxShadow: "0 1px 2px rgba(31,72,125,.04)",
                }}
              >
                <div className="mb-2.5 flex items-start gap-2.5">
                  <Avatar
                    name={note.authorName ?? "Someone"}
                    src={note.authorPhoto ?? undefined}
                    size={30}
                    className="text-[10px]"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[13px] font-semibold">
                        {note.authorName ?? "Someone"}
                      </span>
                      {note.visibility === "client_visible" ? (
                        <Pill tone="info">Client visible</Pill>
                      ) : (
                        <Pill tone="neutral">Internal</Pill>
                      )}
                    </div>
                    <div className="mt-0.5 text-[11.5px]" style={{ color: "var(--text-quiet)" }}>
                      {shortDate(note.createdAt)}
                      {" · "}
                      {relativeTime(note.createdAt)}
                    </div>
                  </div>
                </div>
                <p
                  className="whitespace-pre-wrap text-[13.5px] leading-[1.65]"
                  style={{ color: "var(--text-secondary)" }}
                >
                  {note.body}
                </p>
              </article>
            ))}
          </ShowMore>
        </div>
      )}
    </div>
  );
}
