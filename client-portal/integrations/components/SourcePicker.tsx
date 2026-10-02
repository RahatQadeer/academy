"use client";

import { useState } from "react";
import { initialsFrom } from "@/base/components/Avatar";
import {
  SOURCE_KIND_LABEL,
  type ChosenSource,
  type SourceOption,
} from "@/client-portal/lib/integrations/catalog";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Whose mail may be read — the Gmail half of Manage, as Whitby's
 * `GmailSourcePicker` draws it for a professional.
 *
 * Connecting Gmail says the mailbox *may* be read; nothing here says it *will*
 * read anybody until someone is on this list. The list travels as one hidden
 * JSON input, and the server keeps only ids and kinds from it — a teammate's
 * address is looked up there, never sent here.
 *
 * Offered: the professionals on this client's own conversations, and the other
 * people on their account. Anyone else is typed as an address.
 */
export function SourcePicker({
  team,
  people,
  initial,
}: {
  team: SourceOption[];
  people: SourceOption[];
  initial: ChosenSource[];
}) {
  const [chosen, setChosen] = useState<ChosenSource[]>(initial);
  const [typed, setTyped] = useState("");
  const [problem, setProblem] = useState<string | null>(null);

  const keyOf = (row: { kind: string; sourceId?: string | null; id?: string; email: string | null }) =>
    row.kind === "external" ? `external:${row.email}` : `${row.kind}:${row.sourceId ?? row.id}`;

  const taken = new Set(chosen.map(keyOf));
  const offer = [
    { label: "Your team", options: team },
    { label: "On your account", options: people },
  ]
    .map((group) => ({
      ...group,
      options: group.options.filter((option) => !taken.has(`${option.kind}:${option.id}`)),
    }))
    .filter((group) => group.options.length > 0);

  function add(value: string) {
    const option = [...team, ...people].find((one) => `${one.kind}:${one.id}` === value);
    if (!option) return;
    setChosen((now) => [
      ...now,
      { kind: option.kind, sourceId: option.id, label: option.name, email: option.email },
    ]);
  }

  function addTyped() {
    const email = typed.trim().toLowerCase();
    if (!email) return;
    if (!EMAIL.test(email)) {
      setProblem("That doesn't look like an email address.");
      return;
    }
    if (taken.has(`external:${email}`) || chosen.some((row) => row.email === email)) {
      setProblem("That address is already on the list.");
      return;
    }
    setChosen((now) => [...now, { kind: "external", sourceId: null, label: email, email }]);
    setTyped("");
    setProblem(null);
  }

  return (
    <section className="mt-6">
      <h3 className="text-[13.5px] font-semibold">Whose email may be read</h3>
      <p className="mt-1 text-[12.5px] leading-[1.55]" style={{ color: "var(--text-tertiary)" }}>
        Only mail to and from these people is read and summarised. Everything else in your
        mailbox is never opened. Removing someone stops reading them from now on.
      </p>

      <input type="hidden" name="sources" value={JSON.stringify(chosen)} />

      <div
        className="mt-3 overflow-hidden rounded-[8px] border"
        style={{ borderColor: "var(--border)" }}
      >
        {chosen.length === 0 ? (
          <p
            className="px-4 py-5 text-center text-[13px]"
            style={{ color: "var(--text-tertiary)", background: "var(--surface-subtle)" }}
          >
            Nobody yet, so nothing is read.
          </p>
        ) : (
          <ul>
            {chosen.map((row) => (
              <li
                key={keyOf(row)}
                className="flex items-center gap-3 border-b px-3.5 py-2.5 last:border-b-0"
                style={{ borderColor: "var(--border)" }}
              >
                <span
                  aria-hidden
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold"
                  style={
                    row.kind === "team"
                      ? { background: "var(--avatar-blue-bg)", color: "var(--avatar-blue-fg)" }
                      : { background: "var(--avatar-tan-bg)", color: "var(--avatar-tan-fg)" }
                  }
                >
                  {row.kind === "external" ? "@" : initialsFrom(row.label)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13.5px] font-medium">{row.label}</span>
                  <span className="block truncate text-[12px]" style={{ color: "var(--text-tertiary)" }}>
                    {row.kind === "person" && row.email
                      ? `${SOURCE_KIND_LABEL.person} · ${row.email}`
                      : SOURCE_KIND_LABEL[row.kind]}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => setChosen((now) => now.filter((one) => keyOf(one) !== keyOf(row)))}
                  aria-label={`Stop reading mail with ${row.label}`}
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-[var(--surface-soft)]"
                  style={{ color: "var(--text-tertiary)" }}
                >
                  <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden>
                    <path d="M1.5 1.5l7 7M8.5 1.5l-7 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-2.5 flex flex-col gap-2 sm:flex-row">
        {offer.length > 0 ? (
          <select
            value=""
            onChange={(event) => {
              if (event.target.value) add(event.target.value);
            }}
            aria-label="Add someone whose email may be read"
            className="min-w-0 rounded-control border border-line-strong bg-surface px-3 py-2 text-[13px] sm:w-[46%]"
          >
            <option value="">Add someone…</option>
            {offer.map((group) => (
              <optgroup key={group.label} label={group.label}>
                {group.options.map((option) => (
                  <option key={option.id} value={`${option.kind}:${option.id}`}>
                    {option.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        ) : null}

        <div className="flex min-w-0 flex-1 gap-2">
          <input
            type="email"
            value={typed}
            onChange={(event) => {
              setTyped(event.target.value);
              setProblem(null);
            }}
            // Enter would otherwise submit the dialog — saving, instead of
            // adding the address just typed.
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                addTyped();
              }
            }}
            placeholder="Or type an email address"
            aria-label="Email address to add"
            className="min-w-0 flex-1 rounded-control border border-line-strong bg-surface px-3 py-2 text-[13px] placeholder:text-[var(--text-quiet)]"
          />
          <button
            type="button"
            onClick={addTyped}
            className="shrink-0 rounded-control border border-line-strong px-3.5 py-2 text-[13px] font-medium transition-colors hover:bg-surface-soft"
          >
            Add
          </button>
        </div>
      </div>

      {problem ? (
        <p role="alert" className="mt-1.5 text-[12px]" style={{ color: "var(--danger-text)" }}>
          {problem}
        </p>
      ) : null}
    </section>
  );
}
