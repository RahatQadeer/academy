"use client";

import { useState } from "react";
import { DOCUMENT_LABEL_PRESETS } from "@/whitbyos/lib/document-vocab";

/**
 * 12.2's label row — the five chips, togglable, posted as one comma list.
 *
 * The year chip is this year rather than the year the reference was drawn,
 * so the preset stays the one somebody filing today would reach for.
 */
export function LabelChips({ name = "labels" }: { name?: string }) {
  const [selected, setSelected] = useState<string[]>([]);
  const presets = [...DOCUMENT_LABEL_PRESETS, String(new Date().getFullYear())];

  return (
    <>
      <input type="hidden" name={name} value={selected.join(", ")} />
      <div className="flex flex-wrap gap-1.5">
        {presets.map((label) => {
          const on = selected.includes(label);
          return (
            <button
              key={label}
              type="button"
              onClick={() =>
                setSelected((current) =>
                  current.includes(label)
                    ? current.filter((item) => item !== label)
                    : [...current, label],
                )
              }
              className="rounded border px-[7px] py-px text-[10.5px]"
              style={
                on
                  ? {
                      borderColor: "var(--accent)",
                      color: "var(--accent)",
                      background: "var(--accent-tint-mid)",
                    }
                  : { borderColor: "var(--border)", color: "var(--text-secondary)" }
              }
            >
              {label}
            </button>
          );
        })}
      </div>
    </>
  );
}
