"use client";

import { useState } from "react";
import { NOTIFICATION_EVENTS } from "@/whitbyos/lib/settings-vocab";

/**
 * 17.3's toggle rows, grouped EMAIL then IN-APP.
 *
 * The switch is a checkbox underneath — it submits with the form, works from
 * the keyboard, and is announced properly — with the track and knob drawn over
 * it. `peer-checked` moves the knob, so nothing here has to track state to
 * paint it.
 */
export function NotificationToggles({ prefs }: { prefs: Record<string, boolean> }) {
  const groups = [
    { channel: "email" as const, label: "EMAIL" },
    { channel: "in_app" as const, label: "IN-APP" },
  ];

  return (
    <>
      {groups.map((group) => (
        <div key={group.channel} className="mb-7 last:mb-0">
          <div
            className="mb-2.5 text-[11.5px] font-semibold"
            style={{ color: "var(--text-tertiary)" }}
          >
            {group.label}
          </div>

          <div className="flex flex-col overflow-hidden rounded-[8px] border border-line">
            {NOTIFICATION_EVENTS.filter((event) => event.channel === group.channel).map((event) => (
              <Row
                key={event.key}
                name={`${event.channel}:${event.key}`}
                label={event.label}
                defaultOn={prefs[`${event.channel}:${event.key}`] !== false}
              />
            ))}
          </div>
        </div>
      ))}
    </>
  );
}

function Row({
  name,
  label,
  defaultOn,
}: {
  name: string;
  label: string;
  defaultOn: boolean;
}) {
  const [on, setOn] = useState(defaultOn);

  return (
    <label className="flex items-center justify-between gap-4 border-b border-line px-4 py-[13px] last:border-b-0">
      <span className="text-[13.5px]">{label}</span>

      <span className="relative inline-flex shrink-0">
        <input
          type="checkbox"
          name={name}
          checked={on}
          onChange={(event) => setOn(event.target.checked)}
          className="peer absolute inset-0 h-full w-full cursor-pointer opacity-0"
        />
        <span
          aria-hidden
          className="h-5 w-9 rounded-full transition-colors"
          style={{ background: on ? "var(--accent)" : "var(--border-strong)" }}
        />
        <span
          aria-hidden
          className="absolute top-[2px] h-4 w-4 rounded-full bg-white transition-all"
          style={{ left: on ? "18px" : "2px", boxShadow: "0 1px 2px rgba(0,0,0,.2)" }}
        />
      </span>
    </label>
  );
}
