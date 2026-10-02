"use client";

import { useEffect, useState } from "react";
import { CONTROL } from "@/whitbyos/settings/components/Fields";
import {
  SESSION_TIMEOUT_OPTIONS,
  parseSessionTimeout,
  readSessionTimeout,
  writeSessionTimeout,
  type SessionTimeoutMinutes,
} from "@/whitbyos/lib/session-timeout";

export function SessionTimeoutField() {
  const [minutes, setMinutes] = useState<SessionTimeoutMinutes>(0);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setMinutes(readSessionTimeout());
  }, []);

  function onChange(next: SessionTimeoutMinutes) {
    setMinutes(next);
    writeSessionTimeout(next);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1600);
  }

  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <label className="min-w-[200px] flex-1">
        <span className="mb-1.5 block text-[12.5px] font-medium" style={{ color: "var(--text-secondary)" }}>
          Sign out after
        </span>
        <select
          value={minutes}
          onChange={(event) => onChange(parseSessionTimeout(event.target.value))}
          className={CONTROL}
        >
          {SESSION_TIMEOUT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <span
        className="pb-2 text-[12.5px]"
        style={{ color: saved ? "var(--accent)" : "transparent" }}
        aria-live="polite"
      >
        Saved
      </span>
    </div>
  );
}
