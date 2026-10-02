"use client";

import { useState } from "react";
import { cn } from "@/base/lib/cn";

const URGENCY = ["low", "medium", "high", "critical"] as const;
const URGENCY_LABELS = ["Low", "Medium", "High", "Critical"];

const HEALTH = [
  { value: "on_track", label: "On Track", bg: "var(--success-bg)", fg: "var(--success-fg)" },
  { value: "needs_attention", label: "Needs Attn.", bg: "var(--warning-bg)", fg: "var(--warning-fg)" },
  { value: "at_risk", label: "At Risk", bg: "var(--danger-bg)", fg: "var(--danger-fg)" },
] as const;

/**
 * The Urgency slider from screens 1.2 and 06a.
 *
 * Four labelled stops rather than a range input: the design puts the words
 * under the track and marks the chosen one, and a native slider gives no way
 * to say which word a position means. Each stop is a button, so it is reachable
 * by keyboard and readable by a screen reader; the track is the picture.
 */
export function UrgencyField({ name, defaultValue = "medium" }: { name: string; defaultValue?: string }) {
  const initial = Math.max(0, URGENCY.indexOf(defaultValue as (typeof URGENCY)[number]));
  const [index, setIndex] = useState(initial === -1 ? 1 : initial);

  const percent = (index / (URGENCY.length - 1)) * 100;

  return (
    <div className="flex flex-1 flex-col gap-2">
      <span className="text-[12.5px] font-medium" style={{ color: "var(--text-tertiary)" }}>
        Urgency
      </span>

      <input type="hidden" name={name} value={URGENCY[index]} />

      <div className="px-0.5 pt-2">
        <div
          className="relative h-1 rounded-[2px]"
          style={{ background: "var(--border)" }}
          aria-hidden
        >
          <div
            className="h-1 rounded-[2px]"
            style={{ width: `${percent}%`, background: "var(--accent)" }}
          />
          <div
            className="absolute top-[-6px] h-4 w-4 rounded-full border-2 border-white"
            style={{
              left: `calc(${percent}% - 8px)`,
              background: "var(--accent)",
              boxShadow: "0 1px 4px rgba(15,15,15,.3)",
            }}
          />
        </div>

        <div className="mt-2 flex justify-between" role="radiogroup" aria-label="Urgency">
          {URGENCY_LABELS.map((label, i) => (
            <button
              key={label}
              type="button"
              role="radio"
              aria-checked={i === index}
              onClick={() => setIndex(i)}
              className={cn("text-[10.5px]", i === index ? "font-semibold" : "font-normal")}
              style={{ color: i === index ? "var(--accent)" : "rgba(55,53,47,.45)" }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/** The Health chips from the same two screens — three states, one chosen. */
export function HealthField({ name, defaultValue = "on_track" }: { name: string; defaultValue?: string }) {
  const [value, setValue] = useState(defaultValue);

  return (
    <div className="flex flex-1 flex-col gap-2">
      <span className="text-[12.5px] font-medium" style={{ color: "var(--text-tertiary)" }}>
        Health
      </span>

      <input type="hidden" name={name} value={value} />

      <div className="flex gap-1.5" role="radiogroup" aria-label="Health">
        {HEALTH.map((option) => {
          const chosen = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={chosen}
              onClick={() => setValue(option.value)}
              className="flex-1 rounded-control px-1.5 py-2 text-center text-[11.5px] font-medium"
              style={
                chosen
                  ? {
                      background: option.bg,
                      color: option.fg,
                      border: `1.5px solid ${option.fg}33`,
                    }
                  : {
                      background: "var(--surface)",
                      color: "var(--text-secondary)",
                      border: "1px solid var(--border-strong)",
                    }
              }
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
