"use client";

import { useState } from "react";
import type {
  GmailPicker,
  GmailSelectedSource,
} from "@/whitbyos/lib/gmail-context";

/**
 * Screen 16.2's Gmail half — who Whitby may read incoming mail from.
 *
 * The connection and this list are two different permissions, and the dialog
 * has to draw both: connecting Gmail says Whitby *may* read the mailbox, and
 * nothing in here says it *will* read anybody. Without this control the switch
 * above would be the only thing on the screen and would read as "sync my mail",
 * which is the one thing the product does not do.
 *
 * The chips are the whole value. It travels as one hidden JSON input rather
 * than a field per person because each row is four things — kind, source,
 * client and address — and `getAll` on four parallel inputs would let them
 * drift out of step.
 *
 * A hand-typed address is kept as `external`: the people who write to a family
 * office are mostly not records in it — an airline, a lawyer's assistant, a
 * school — and requiring a contact first would make the common case the long
 * way round.
 */
export function GmailSourcePicker({
  picker,
  initial,
}: {
  picker: GmailPicker;
  initial: GmailSelectedSource[];
}) {
  const [chosen, setChosen] = useState<GmailSelectedSource[]>(initial);
  const [typed, setTyped] = useState("");
  const [problem, setProblem] = useState<string | null>(null);

  const taken = new Set(chosen.map((row) => row.email));

  const groups: { label: string; options: GmailPicker["clients"] }[] = [
    { label: "Clients", options: picker.clients },
    { label: "People", options: picker.contacts },
    { label: "Team", options: picker.team },
  ];

  // A client with no primary contact and a teammate with no address on their
  // user row have no mail to read, so they are not offered.
  const offerable = groups
    .map((group) => ({
      ...group,
      options: group.options.filter(
        (option) => option.email && !taken.has(option.email.trim().toLowerCase()),
      ),
    }))
    .filter((group) => group.options.length > 0);

  function add(id: string) {
    for (const group of groups) {
      const option = group.options.find((row) => row.id === id);
      if (!option?.email) continue;

      const email = option.email.trim().toLowerCase();
      if (taken.has(email)) return;

      setChosen((now) => [
        ...now,
        {
          kind: option.kind,
          sourceId: option.id,
          clientId: option.clientId,
          email,
          label: option.name,
        },
      ]);
      return;
    }
  }

  function addTyped() {
    const email = typed.trim().toLowerCase();
    if (!email) return;

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setProblem("That does not look like an email address.");
      return;
    }

    if (taken.has(email)) {
      setProblem("That address is already on the list.");
      return;
    }

    setChosen((now) => [
      ...now,
      { kind: "external", sourceId: null, clientId: null, email, label: email },
    ]);
    setTyped("");
    setProblem(null);
  }

  return (
    <div className="mb-5 flex flex-col gap-1.5 border-t border-line pt-4">
      <span className="text-[12.5px] font-medium">Whitby may read mail from</span>
      <span className="mb-1 text-[11.5px] leading-[1.5]" style={{ color: "var(--text-faint)" }}>
        Only these senders. Everything else in the mailbox is ignored. Removing
        someone stops Whitby reading them from now on; what it already read
        stays with the work it belongs to.
      </span>

      <div className="flex flex-wrap items-center gap-1.5 rounded-control border border-line-strong bg-surface px-2.5 py-2">
        {/* Sent even when nothing is chosen, so an empty list reads as "nobody"
            rather than as a field the form forgot to include. */}
        <input type="hidden" name="gmail_sources" value={JSON.stringify(chosen)} />

        {chosen.map((row) => (
          <span
            key={row.email}
            className="flex items-center gap-[5px] rounded-[5px] py-[3px] pl-2 pr-2 text-[12.5px]"
            style={{ background: "var(--canvas)" }}
          >
            <span>{row.label}</span>
            {row.label !== row.email ? (
              <span style={{ color: "var(--text-faint)" }}>{row.email}</span>
            ) : null}
            <button
              type="button"
              onClick={() =>
                setChosen((now) => now.filter((one) => one.email !== row.email))
              }
              aria-label={`Remove ${row.label}`}
              className="cursor-pointer text-[11px]"
              style={{ color: "var(--text-tertiary)" }}
            >
              ✕
            </button>
          </span>
        ))}

        {offerable.length > 0 ? (
          <select
            value=""
            onChange={(event) => {
              if (event.target.value) add(event.target.value);
            }}
            aria-label="Add someone Whitby may read"
            className="cursor-pointer border-none bg-transparent text-[12.5px] outline-none"
            style={{ color: "var(--text-tertiary)" }}
          >
            <option value="">+ Add someone…</option>
            {offerable.map((group) => (
              <optgroup key={group.label} label={group.label}>
                {group.options.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.name} · {option.email}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        ) : null}

        {chosen.length === 0 && offerable.length === 0 ? (
          <span className="text-[12.5px]" style={{ color: "var(--text-faint)" }}>
            Nobody in this workspace has an email address yet
          </span>
        ) : null}
      </div>

      <div className="mt-1 flex items-center gap-2">
        <input
          type="text"
          value={typed}
          onChange={(event) => {
            setTyped(event.target.value);
            setProblem(null);
          }}
          // Enter inside a dialog would otherwise submit the form, saving the
          // settings instead of adding the address that was just typed.
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              addTyped();
            }
          }}
          placeholder="Or an address not in Whitby yet"
          aria-label="Add an email address"
          className="min-w-0 flex-1 rounded-control border border-line-strong bg-surface px-2.5 py-[7px] text-[12.5px] outline-none"
        />
        <button
          type="button"
          onClick={addTyped}
          className="shrink-0 rounded-control border border-line-strong px-3 py-[7px] text-[12.5px] font-medium"
          style={{ background: "var(--surface)", color: "var(--ink)" }}
        >
          Add
        </button>
      </div>

      {problem ? (
        <span className="text-[11.5px]" style={{ color: "var(--danger-outline-fg)" }}>
          {problem}
        </span>
      ) : null}
    </div>
  );
}
