"use client";

import { useState } from "react";

/**
 * Who is coming, however many of them there are.
 *
 * One text box said nothing about whether a second name was allowed, and the
 * column behind it is a line of text — so people wrote "Ade and the notary"
 * into it and the event had one attendee called that. Names are added one at a
 * time and drawn as chips; what is stored is still the line of text, joined
 * with commas, so nothing else that reads an event has to change.
 *
 * The list of people is offered rather than imposed: a meeting can have
 * somebody in it who is in none of Whitby's lists, so anything typed is
 * accepted.
 */
export function AttendeePicker({
  people,
  initial,
}: {
  people: { name: string; detail: string | null }[];
  /** What is already on the event, as it was stored. */
  initial?: string | null;
}) {
  const [chosen, setChosen] = useState<string[]>(() =>
    (initial ?? "")
      .split(",")
      .map((name) => name.trim())
      .filter(Boolean),
  );
  const [typed, setTyped] = useState("");

  const add = (name: string) => {
    const clean = name.trim();
    if (!clean) return;
    if (chosen.some((person) => person.toLowerCase() === clean.toLowerCase())) {
      setTyped("");
      return;
    }
    setChosen([...chosen, clean]);
    setTyped("");
  };

  const left = people.filter(
    (person) => !chosen.some((name) => name.toLowerCase() === person.name.toLowerCase()),
  );

  return (
    <div>
      {/* What the form actually posts: the same line of text as before. */}
      <input type="hidden" name="attendees" value={chosen.join(", ")} />

      {chosen.length > 0 ? (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {chosen.map((name) => (
            <span
              key={name}
              className="flex items-center gap-1.5 rounded-[6px] px-2 py-[3px] text-[12.5px]"
              style={{ background: "var(--surface-active)", color: "var(--ink)" }}
            >
              {name}
              <button
                type="button"
                onClick={() => setChosen(chosen.filter((person) => person !== name))}
                aria-label={`Remove ${name}`}
                className="text-[12px] leading-none"
                style={{ color: "var(--text-tertiary)" }}
              >
                ✕
              </button>
            </span>
          ))}
        </div>
      ) : null}

      <div className="flex gap-2">
        <input
          value={typed}
          list="event-attendees"
          onChange={(event) => setTyped(event.target.value)}
          onKeyDown={(event) => {
            // Enter adds the name rather than submitting the whole form, which
            // on a dialog of nine fields is a surprise nobody wants.
            if (event.key !== "Enter") return;
            event.preventDefault();
            add(typed);
          }}
          placeholder={left.length > 0 ? "Type a name, or pick from the list" : "Type a name"}
          className="w-full rounded-control border border-line-strong bg-surface px-2.5 py-[9px] text-[13.5px] text-ink"
        />

        <button
          type="button"
          onClick={() => add(typed)}
          disabled={!typed.trim()}
          className="shrink-0 rounded-control border px-3.5 py-[9px] text-[13px] font-medium"
          style={{
            borderColor: "var(--chrome-line)",
            background: typed.trim() ? "var(--surface)" : "var(--surface-subtle)",
            color: typed.trim() ? "var(--ink)" : "var(--text-disabled)",
          }}
        >
          Add
        </button>
      </div>

      <datalist id="event-attendees">
        {left.map((person) => (
          <option key={person.name} value={person.name}>
            {person.detail ?? ""}
          </option>
        ))}
      </datalist>

      {people.length > 0 ? (
        <span className="mt-1.5 block text-[11.5px]" style={{ color: "var(--text-tertiary)" }}>
          This client&rsquo;s contacts, your team and their providers are suggested.
          Anybody else can be typed in.
        </span>
      ) : null}
    </div>
  );
}
