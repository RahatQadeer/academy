"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Pill } from "@/base/components/Pill";
import { ShowMore } from "@/whitbyos/components/ShowMore";
import { shortDate } from "@/whitbyos/lib/format";
import type { ClientDocument } from "@/whitbyos/lib/client-detail";
import {
  documentStatusLabel,
  documentStatusTone,
} from "@/whitbyos/lib/document-vocab";

/*
 * The name takes the room; the rest take what they need.
 *
 * At `2.2fr 1fr 1fr` a status pill and a date each had a fifth of a very
 * wide page to sit in, and the name — the only column with anything long
 * in it — was cut to make space for that whitespace. These titles all open
 * "What we need from you: Okonkwo family relocation from Lagos to Dubai:",
 * so what was being cut off the end was the only part that said which file
 * this was.
 */
const COLUMNS =
  "[grid-template-columns:minmax(0,1fr)_minmax(104px,max-content)_minmax(64px,max-content)_16px]";

/**
 * Request → Documents tab: live search, prettier rows, Show more at 10+.
 */
export function RequestDocumentsList({ documents }: { documents: ClientDocument[] }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return documents;
    return documents.filter((document) => {
      const hay = [
        document.title,
        documentStatusLabel(document.status),
        document.status,
        document.source,
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(needle);
    });
  }, [documents, query]);

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
          placeholder="Search documents…"
          aria-label="Search documents"
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
          className="rounded-[12px] border px-5 py-8 text-center text-[13.5px]"
          style={{
            borderColor: "color-mix(in srgb, var(--chrome-line) 85%, #c5ced8)",
            background: "var(--surface)",
            color: "var(--text-tertiary)",
          }}
        >
          {query.trim()
            ? `No documents match “${query.trim()}”.`
            : "Nothing filed against this Request yet."}
        </div>
      ) : (
        <div
          className="overflow-hidden rounded-[12px] border"
          style={{
            borderColor: "color-mix(in srgb, var(--chrome-line) 85%, #c5ced8)",
            background: "var(--surface)",
            boxShadow: "0 1px 2px rgba(31,72,125,.04)",
          }}
        >
          <div
            className={`grid ${COLUMNS} items-center gap-3 border-b px-4 py-2.5 text-[11.5px] font-semibold`}
            style={{
              borderColor: "var(--chrome-line)",
              background: "var(--surface-soft)",
              color: "var(--text-tertiary)",
            }}
          >
            <span>Document</span>
            <span>Status</span>
            <span>Updated</span>
            <span />
          </div>

          <ShowMore step={10}>
            {filtered.map((document) => (
              <Link
                key={document.id}
                href={`/whitbyos/documents?doc=${document.id}`}
                className={`group grid ${COLUMNS} items-center gap-3 border-b px-4 py-3 no-underline transition-colors last:border-b-0 hover:bg-[var(--surface-soft)]`}
                style={{ borderColor: "var(--chrome-line)", color: "var(--ink)" }}
              >
                <span className="min-w-0 truncate text-[13.5px]" title={document.title}>
                  {document.title}
                </span>
                <span>
                  <Pill tone={documentStatusTone(document.status)}>
                    {documentStatusLabel(document.status)}
                  </Pill>
                </span>
                <span
                  className="whitespace-nowrap text-[12.5px]"
                  style={{ color: "var(--text-tertiary)" }}
                >
                  {shortDate(document.created_at)}
                </span>
                {/* The row opens the document. Nothing on it said so. */}
                <span
                  aria-hidden
                  className="text-[13px] transition-transform group-hover:translate-x-0.5"
                  style={{ color: "var(--text-disabled)" }}
                >
                  →
                </span>
              </Link>
            ))}
          </ShowMore>
        </div>
      )}
    </div>
  );
}
