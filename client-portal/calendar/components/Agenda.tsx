"use client";

import { useEffect, useMemo, useState } from "react";
import { relativeTime, timeRange } from "@/client-portal/lib/format";
import type { CalendarTab } from "@/client-portal/lib/data/calendar";
import type { CalendarItem } from "@/client-portal/types";
import { ChipNav } from "@/client-portal/components/ChipNav";
import {
  ListPanel,
  PanelBody,
  PanelEmpty,
  PanelGroup,
  PanelRow,
  PanelTags,
  PanelTile,
  PanelTitle,
} from "@/client-portal/components/Panel";
import {
  AGENDA_LABEL,
  AGENDA_TABS,
  agendaHref,
  groupAgenda,
  matchesAgendaSearch,
} from "./agenda-data";
import { KindPill, RequestChip, SourceMark } from "./EventRow";
import { cardStyle, chipStyle } from "./vocab";

/**
 * The agenda, in the portal's list panel.
 *
 * It used to be a five-column table under a row of underlined tabs, and it
 * asked the client to find out where their calendar was by visiting each tab
 * in turn. Two things fix that, and both are now shared with every other list
 * screen rather than invented here:
 *
 *   — chips that carry their own counts, so an empty tab says so from the row
 *     rather than after a navigation, and All is there to be landed on;
 *   — rows that lead with a tile, which here holds the date, because a calendar
 *     is read by date before it is read by title.
 *
 * The search is this screen's own, and is the one difference from the rest:
 * every event the page lists is already in hand, so it filters as you type
 * instead of going back to the server for an answer it already has.
 */
export function Agenda({
  items,
  tab,
  counts,
  timeZone,
  today,
  tomorrow,
  initialQuery,
}: {
  /** This tab's events, already filtered and ordered on the server. */
  items: CalendarItem[];
  tab: CalendarTab;
  counts: Record<CalendarTab, number>;
  timeZone: string;
  /** Today and tomorrow as ISO days in `timeZone`, decided on the server. */
  today: string;
  tomorrow: string;
  initialQuery: string;
}) {
  const [query, setQuery] = useState(initialQuery);
  const needle = query.trim().toLowerCase();

  // Kept in the URL without a navigation — this route re-renders the whole
  // content area on one — so a search survives a refresh and can be linked to.
  useEffect(() => {
    const url = new URL(window.location.href);
    if (needle) url.searchParams.set("q", query.trim());
    else url.searchParams.delete("q");
    if (url.href !== window.location.href) window.history.replaceState(null, "", url.href);
  }, [needle, query]);

  const visible = useMemo(
    () => items.filter((item) => matchesAgendaSearch(item, needle)),
    [items, needle],
  );

  const groups = useMemo(
    () => groupAgenda(visible, tab, timeZone, today, tomorrow),
    [visible, tab, timeZone, today, tomorrow],
  );

  const q = query.trim() || undefined;

  return (
    <ListPanel
      controls={
        <>
          <label
            className="pa-chat-search mb-3 flex items-center gap-2 rounded-full border px-3 py-[7px] transition-[border-color,box-shadow,background-color] duration-200"
            style={{ background: "var(--surface-soft)", borderColor: "var(--chat-line)" }}
          >
            <span
              className="shrink-0 text-[12.5px]"
              style={{ color: "var(--text-tertiary)" }}
              aria-hidden
            >
              ⌕
            </span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape") setQuery("");
              }}
              placeholder="Search events, places and requests"
              aria-label="Search the calendar"
              className="min-w-0 flex-1 border-none bg-transparent text-[13px] outline-none [&::-webkit-search-cancel-button]:hidden"
              style={{ color: "var(--ink)" }}
            />
            {query ? (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Clear search"
                className="shrink-0 text-[13px] leading-none"
                style={{ color: "var(--text-tertiary)" }}
              >
                ×
              </button>
            ) : null}
          </label>

          <ChipNav
            label="Calendar filters"
            active={tab}
            chips={AGENDA_TABS.map((key) => ({
              key,
              label: AGENDA_LABEL[key],
              href: agendaHref({ tab: key, q }),
              count: counts[key],
              urgent: key === "key-dates",
            }))}
          />
        </>
      }
    >
      {visible.length === 0 ? (
        <AgendaEmpty searching={Boolean(needle)} tab={tab} onClear={() => setQuery("")} />
      ) : (
        groups.map((group) => (
          <PanelGroup key={group.key} label={group.label} note={group.past ? "Past" : undefined}>
            {group.items.map((item) => (
              <EventLine
                key={item.id}
                item={item}
                href={agendaHref({ tab, q, event: item.id })}
                timeZone={timeZone}
                past={group.past}
                // Under a By Request heading the heading already names the
                // Request, and repeating it on every row says nothing.
                showRequest={tab !== "by-request"}
              />
            ))}
          </PanelGroup>
        ))
      )}
    </ListPanel>
  );
}

/**
 * One event.
 *
 * The shared row with the date in its tile, tinted in the event's own kind, so
 * meetings, key dates and the client's own entries are told apart down the left
 * edge without reading a word.
 */
function EventLine({
  item,
  href,
  timeZone,
  past,
  showRequest,
}: {
  item: CalendarItem;
  href: string;
  timeZone: string;
  past: boolean;
  showRequest: boolean;
}) {
  const declined = item.personal?.declined === true;
  const when = item.allDay ? "All day" : timeRange(item.startAt, item.endAt, timeZone);
  const where = [when, item.location].filter(Boolean).join(" · ");

  return (
    <PanelRow href={href} when={relativeTime(item.startAt)} dim={past}>
      <DateTile item={item} timeZone={timeZone} />

      <PanelBody>
        <PanelTitle strike={declined}>
          {item.title}
        </PanelTitle>

        <span
          className="flex items-center gap-1.5 text-[12.5px]"
          style={{ color: "var(--text-tertiary)" }}
        >
          <SourceMark item={item} />
          <span className="min-w-0 truncate">{where}</span>
        </span>

        <PanelTags>
          <KindPill item={item} />
          {showRequest && item.requestTitle ? <RequestChip title={item.requestTitle} /> : null}
        </PanelTags>
      </PanelBody>
    </PanelRow>
  );
}

/**
 * The date, in the tile every other screen puts a glyph in.
 *
 * The card's ground with the chip's ink on it: `markColor` is the colour a
 * source's dot is drawn in, which on an event held by the team is the disabled
 * grey and unreadable at this size.
 */
function DateTile({ item, timeZone }: { item: CalendarItem; timeZone: string }) {
  const date = new Date(item.startAt);

  return (
    <PanelTile style={{ ...cardStyle(item), color: chipStyle(item).color }}>
      <span className="text-[9.5px] font-semibold uppercase leading-none tracking-[.06em] opacity-80">
        {date.toLocaleDateString("en-US", { weekday: "short", timeZone })}
      </span>
      <span className="mt-[3px] text-[16px] font-bold leading-none">
        {date.toLocaleDateString("en-US", { day: "numeric", timeZone })}
      </span>
    </PanelTile>
  );
}

/**
 * Nothing here.
 *
 * With All carrying a count of everything, an empty tab is now a fact the
 * client chose to look at rather than one they stumbled into, so each one says
 * what it is missing and leaves the way back to the whole calendar open.
 */
function AgendaEmpty({
  searching,
  tab,
  onClear,
}: {
  searching: boolean;
  tab: CalendarTab;
  onClear: () => void;
}) {
  const copy = searching
    ? {
        title: "Nothing matches that",
        detail: "No event here mentions that. Clear the search to see the rest.",
      }
    : tab === "meetings"
      ? {
          title: "No meetings coming up",
          detail: "Calls, interviews and appointments your team books with you show here.",
        }
      : tab === "key-dates"
        ? {
            title: "No key dates coming up",
            detail: "Deadlines and dates that drive your work show here.",
          }
        : tab === "by-request"
          ? {
              title: "Nothing linked to a request",
              detail: "Events booked against a request are listed under it here.",
            }
          : tab === "past"
            ? {
                title: "Nothing in the past",
                detail: "Events that have been show here afterwards.",
              }
            : {
                title: "Nothing scheduled",
                detail:
                  "Calls, appointments, travel and deadlines your team shares with you will show up here.",
              };

  // The search is state on this screen rather than a URL, so clearing it is a
  // button where every other screen's is a link back to the unfiltered list.
  if (searching) {
    return (
      <div className="cp-fade-up flex flex-col items-center gap-2.5 px-6 py-16 text-center">
        <div
          className="flex h-12 w-12 items-center justify-center rounded-[14px] text-[18px]"
          style={{ background: "var(--accent-tint)", color: "var(--accent)" }}
          aria-hidden
        >
          ⌕
        </div>
        <div className="text-[13.5px] font-semibold">{copy.title}</div>
        <div
          className="max-w-[340px] text-[12.5px] leading-[1.5]"
          style={{ color: "var(--text-tertiary)" }}
        >
          {copy.detail}
        </div>
        <button
          type="button"
          onClick={onClear}
          className="cp-press mt-1 rounded-full px-3 py-1 text-[12.5px] font-medium hover:bg-[var(--surface-active)]"
          style={{ color: "var(--accent)" }}
        >
          Clear search
        </button>
      </div>
    );
  }

  return (
    <PanelEmpty
      glyph="▦"
      title={copy.title}
      detail={copy.detail}
      action={
        tab === "all" ? undefined : { label: "See the whole calendar", href: agendaHref({}) }
      }
    />
  );
}
