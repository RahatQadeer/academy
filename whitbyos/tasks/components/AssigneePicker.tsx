"use client";

import { useState } from "react";
import { OwnerAvatar } from "@/whitbyos/components/OwnerAvatar";

export type Person = { id: string; name: string; hasPhoto?: boolean };

/**
 * 16z's Assignees field — chips inside one bordered box, with a picker on the
 * end that reads "+ Add assignee…".
 *
 * A native `<select multiple>` stood here first. It held the same information
 * and was the wrong control twice over: it fills the chosen rows with the
 * browser's own grey, and it asks somebody to know that ⌘ picks a second
 * person. The reference draws neither, and the reference is right — who is on
 * a task is a small set you add to and take from, not a list you shift-click.
 *
 * The value travels as one hidden input per person, so the server reads
 * `getAll("assignees")` whether this ran or not.
 */
export function AssigneePicker({
  people,
  initial = [],
  currentUserId,
  label = "Assignees",
}: {
  people: Person[];
  initial?: string[];
  currentUserId?: string;
  label?: string;
}) {
  const [chosen, setChosen] = useState<string[]>(initial);

  const personOf = (id: string) => people.find((person) => person.id === id);
  const nameOf = (id: string) => personOf(id)?.name ?? "Teammate";
  const initialsOf = (id: string) => {
    const parts = nameOf(id).trim().split(/\s+/).filter(Boolean);
    return ((parts[0]?.[0] ?? "?") + (parts[1]?.[0] ?? "")).toUpperCase();
  };

  const left = people.filter((person) => !chosen.includes(person.id));

  return (
    <div className="flex flex-col gap-1.5">
      {label ? (
        <span className="text-[12.5px] font-medium" style={{ color: "var(--text-tertiary)" }}>
          {label}
        </span>
      ) : null}

      <div className="flex flex-wrap items-center gap-1.5 rounded-control border border-line-strong bg-surface px-2.5 py-2">
        {chosen.map((id) => (
          <span
            key={id}
            className="flex items-center gap-[5px] rounded-[5px] py-[3px] pl-1 pr-2 text-[12.5px]"
            style={{ background: "var(--canvas)" }}
          >
            <input type="hidden" name="assignees" value={id} />
            {/* The photo, where there is one — the chip is the same face the
                task row shows, not a different shorthand for it. */}
            <OwnerAvatar
              userId={id}
              initials={initialsOf(id)}
              name={nameOf(id)}
              hasPhoto={personOf(id)?.hasPhoto}
              size={16}
            />
            {nameOf(id)}
            {id === currentUserId ? " (me)" : ""}
            <button
              type="button"
              onClick={() => setChosen((now) => now.filter((one) => one !== id))}
              aria-label={`Remove ${nameOf(id)}`}
              className="cursor-pointer text-[11px]"
              style={{ color: "var(--text-tertiary)" }}
            >
              ✕
            </button>
          </span>
        ))}

        {left.length > 0 ? (
          <select
            value=""
            onChange={(event) => {
              const id = event.target.value;
              if (id) setChosen((now) => [...now, id]);
            }}
            aria-label="Add an assignee"
            className="cursor-pointer border-none bg-transparent text-[12.5px] outline-none"
            style={{ color: "var(--text-tertiary)" }}
          >
            <option value="">+ Add assignee…</option>
            {left.map((person) => (
              <option key={person.id} value={person.id}>
                {person.name}
                {person.id === currentUserId ? " (me)" : ""}
              </option>
            ))}
          </select>
        ) : null}

        {chosen.length === 0 && left.length === 0 ? (
          <span className="text-[12.5px]" style={{ color: "var(--text-faint)" }}>
            Nobody else is in this workspace yet
          </span>
        ) : null}
      </div>

      <span className="text-[11px]" style={{ color: "var(--text-faint)" }}>
        Client contacts cannot be assigned yet, the reference offers it, but what
        a contact would be notified by and see is not settled.
      </span>
    </div>
  );
}
