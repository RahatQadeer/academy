"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { faceForRail, initialsOf } from "@/whitbyos/lib/client-face";
import { openClientWorkspace } from "@/whitbyos/workspaces/actions";

const HERE = "/whitbyos/workspaces";

export type RailCard = {
  id: string;
  name: string;
  photo: string | null;
  activeRequests: number;
  portal: boolean;
};

export function WorkspaceRailList({
  cards,
  openClientId,
}: {
  cards: RailCard[];
  openClientId: string | null;
}) {
  const [query, setQuery] = useState("");
  const needle = query.trim().toLowerCase();
  const visible = useMemo(() => {
    if (!needle) return cards;
    return cards.filter((card) => card.name.toLowerCase().includes(needle));
  }, [cards, needle]);

  return (
    <div className="flex flex-col gap-0.5">
      {cards.length > 0 ? (
        <label className="ws-rail-search relative mb-1.5 block">
          <span
            className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2"
            style={{ color: "var(--text-quiet)" }}
          >
            <SearchMark />
          </span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") setQuery("");
            }}
            placeholder="Search workspaces"
            aria-label="Search workspaces"
            autoComplete="off"
            className="ws-rail-search-field w-full rounded-[6px] py-[7px] pl-8 pr-2.5 text-[13px] outline-none"
          />
        </label>
      ) : null}

      <form action={openClientWorkspace}>
        <input type="hidden" name="client_id" value="" />
        <WorkspaceNavItem
          name="All workspaces"
          glyph="⊞"
          meta="Every client at once"
          current={!openClientId}
          action={
            <button
              type="submit"
              aria-current={!openClientId ? "page" : undefined}
              aria-label="View all workspaces"
              className="absolute inset-0 z-0 cursor-pointer rounded-[6px]"
            />
          }
        />
      </form>

      {cards.length === 0 ? (
        <div className="ws-rail-copy px-2 py-3">
          <p className="text-[13px] leading-snug" style={{ color: "var(--text-secondary)" }}>
            No workspaces yet. Each one holds a single relationship.
          </p>
        </div>
      ) : (
        <div className="ws-rail-clients">
          <p
            className="ws-rail-heading px-1 pb-1 pt-0.5 text-[10px] font-semibold uppercase tracking-[0.12em]"
            style={{ color: "var(--text-quiet)" }}
          >
            Clients
          </p>
          {visible.length === 0 ? (
            <div className="ws-rail-copy px-2 py-2.5">
              <p className="text-[13px] leading-snug" style={{ color: "var(--text-secondary)" }}>
                No workspaces match &ldquo;{query.trim()}&rdquo;.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-0.5">
              {visible.map((card) => (
                <form key={card.id} action={openClientWorkspace} className="relative">
                  <input type="hidden" name="client_id" value={card.id} />
                  <WorkspaceNavItem
                    name={card.name}
                    photo={card.photo}
                    current={card.id === openClientId}
                    meta={[
                      card.activeRequests
                        ? `${card.activeRequests} request${card.activeRequests === 1 ? "" : "s"}`
                        : "No requests",
                      card.portal ? "Portal on" : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                    archiveHref={`${HERE}?archive=${card.id}`}
                    action={
                      <button
                        type="submit"
                        aria-label={
                          card.id === openClientId ? `Back into ${card.name}` : `Open ${card.name}`
                        }
                        className="absolute inset-0 z-0 cursor-pointer rounded-[6px]"
                      />
                    }
                  />
                </form>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function WorkspaceNavItem({
  name,
  photo,
  glyph,
  meta,
  action,
  archiveHref,
  current,
}: {
  name: string;
  photo?: string | null;
  glyph?: string;
  meta?: string;
  action: React.ReactNode;
  archiveHref?: string;
  current?: boolean;
}) {
  return (
    <div className={`ws-rail-row group relative${current ? " is-on" : ""}`}>
      {action}
      {/*
       * On the second line, with the counts.
       *
       * Centred on the row it landed between the two lines and read as
       * though it belonged to the name — the loudest thing in the row
       * answered by the quietest control in it. The line underneath is
       * where the row's small print already lives, which is what Archive
       * is: available, not offered.
       *
       * The row also carried `title={name}`, so hovering raised a native
       * tooltip repeating a name that was right there in full, over the
       * row below and across this link.
       */}
      {archiveHref ? (
        <Link
          href={archiveHref}
          className="ws-rail-archive absolute bottom-[5px] right-1.5 z-[2] rounded-[4px] px-1.5 py-0.5 text-[11px] leading-tight no-underline opacity-0 transition-opacity hover:bg-[var(--surface)] group-hover:opacity-100"
          style={{ color: "var(--text-tertiary)" }}
        >
          Archive
        </Link>
      ) : null}
      <div
        className={`ws-rail-item pointer-events-none relative z-[1] flex items-center gap-2.5 px-2 ${archiveHref ? "pr-9" : ""}`}
      >
        <span
          aria-hidden
          className="ws-rail-avatar flex shrink-0 items-center justify-center overflow-hidden"
          style={
            glyph
              ? {
                  background: "var(--surface-soft)",
                  color: "var(--text-secondary)",
                }
              : photo
                ? { background: "var(--surface)", boxShadow: "inset 0 0 0 1px var(--chrome-line)" }
                : faceForRail(name)
          }
        >
          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={photo}
              alt=""
              className="h-full w-full object-cover"
              referrerPolicy="no-referrer"
            />
          ) : glyph ? (
            <span className="text-[12px] font-medium leading-none">{glyph}</span>
          ) : (
            initialsOf(name)
          )}
        </span>
        <span className="ws-rail-copy min-w-0 flex-1">
          <span className="block truncate text-[13px] font-medium leading-tight">{name}</span>
          {meta ? (
            <span
              className="mt-[1px] block truncate text-[11px] leading-tight"
              style={{ color: "var(--text-tertiary)" }}
            >
              {meta}
            </span>
          ) : null}
        </span>
      </div>
    </div>
  );
}

function SearchMark() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <circle cx="6" cy="6" r="4.2" stroke="currentColor" strokeWidth="1.4" />
      <path d="M9.2 9.2 12 12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}
