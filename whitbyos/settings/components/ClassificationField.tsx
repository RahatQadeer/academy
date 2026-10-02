"use client";

import { useState } from "react";

/**
 * 17.1's client classifications — rounded chips, each with a ✕, and a dashed
 * "+ Add classification" beside them.
 *
 * They submit as repeated hidden inputs so the whole set arrives with the rest
 * of the form and is saved in one go, the way the export's single Save changes
 * implies.
 */
export function ClassificationField({ initial }: { initial: string[] }) {
  const [items, setItems] = useState(initial);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");

  function add() {
    const value = draft.trim();
    // Case-insensitive, because "Estate" and "estate" are the same category to
    // everyone except the array.
    if (value && !items.some((item) => item.toLowerCase() === value.toLowerCase())) {
      setItems([...items, value]);
    }
    setDraft("");
    setAdding(false);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {items.map((item) => (
        <span
          key={item}
          className="flex items-center gap-1.5 rounded-full py-[5px] pl-3 pr-1.5 text-[12.5px] font-medium"
          style={{ background: "var(--canvas)", color: "var(--ink)" }}
        >
          <input type="hidden" name="classification" value={item} />
          {item}
          <button
            type="button"
            onClick={() => setItems(items.filter((row) => row !== item))}
            aria-label={`Remove ${item}`}
            className="p-0.5"
            style={{ color: "var(--text-disabled)" }}
          >
            ✕
          </button>
        </span>
      ))}

      {adding ? (
        <input
          autoFocus
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={add}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              // Not a submit: this form has its own, and adding a chip is not
              // saving the workspace.
              event.preventDefault();
              add();
            }
            if (event.key === "Escape") {
              setDraft("");
              setAdding(false);
            }
          }}
          placeholder="Trust, Foundation…"
          className="rounded-full border border-line-strong px-3 py-[5px] text-[12.5px] outline-none"
          style={{ background: "var(--surface)" }}
        />
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="rounded-full border border-dashed px-3 py-[5px] text-[12.5px] font-medium"
          style={{ borderColor: "var(--border-strong)", color: "var(--text-secondary)" }}
        >
          + Add classification
        </button>
      )}
    </div>
  );
}
