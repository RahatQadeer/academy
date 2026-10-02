"use client";

import { Children, useState, type ReactNode } from "react";

/**
 * The first few, and one press for the rest.
 *
 * A directory is read by scanning it, and a page that opens on forty rows is
 * one nobody scans: the useful ones are wherever they happen to sort. A
 * screenful is enough, and asking for the rest is a decision rather than a
 * scroll.
 *
 * One press, not several. Opening three at a time turned a list of seventeen
 * into five presses, and each one moved everything under it; and a rail
 * 270px wide cannot spell out what is being opened, so the control says the
 * two words it needs and nothing else.
 *
 * The rows are rendered on the server and handed here as children, so nothing
 * is fetched again and nothing is re-rendered when the rest appear. It only
 * decides how many of them to draw.
 */
export function ShowMore({
  children,
  step = 10,
}: {
  children: ReactNode;
  /** How many to show before the press, and what "less" goes back to. */
  step?: number;
}) {
  const items = Children.toArray(children);
  const [all, setAll] = useState(false);

  if (items.length <= step) return <>{items}</>;

  return (
    <>
      {all ? items : items.slice(0, step)}

      {/*
       * A control, not a rule across the panel.
       *
       * It was a full-width band with a line over it, which on a rail of
       * stacked panels read as the end of the panel rather than as something
       * to press. A text control is enough — a bordered box around it felt
       * like a second card inside the card.
       *
       * And it counts. "Show more" beside four visible rows says nothing
       * about whether there are two behind it or forty, which is the one
       * thing somebody wants to know before pressing it.
       */}
      <div className="flex justify-center pt-1.5">
        <button
          type="button"
          onClick={() => setAll((open) => !open)}
          className="px-1 py-0.5 text-[12px] font-medium transition-colors hover:underline"
          style={{ color: "var(--accent)", background: "none", border: 0 }}
        >
          {all ? "Show less" : `Show ${items.length - step} more`}
        </button>
      </div>
    </>
  );
}
