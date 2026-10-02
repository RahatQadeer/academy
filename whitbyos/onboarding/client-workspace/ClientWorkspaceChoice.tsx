"use client";

import { useState } from "react";

/**
 * Setup step 3 — Client Workspace: Yes or No.
 *
 * The explanation sits above the choice so somebody who has never heard the
 * term can pick without guessing. Yes reveals the optional first-client form;
 * No is a complete answer and does not invent a client to get past the wizard.
 */
export function ClientWorkspaceChoice({
  children,
  initial = null,
}: {
  children: React.ReactNode;
  /** The answer this step was given last time, so Back keeps it. */
  initial?: "yes" | "no" | null;
}) {
  const [choice, setChoice] = useState<"yes" | "no" | "">(initial ?? "");

  return (
    <div className="flex flex-col gap-3.5">
      <label className="sr-only" htmlFor="usesClientWorkspaces">
        Workspace
      </label>
      <select
        id="usesClientWorkspaces"
        name="usesClientWorkspaces"
        required
        value={choice}
        onChange={(event) => {
          const value = event.target.value;
          if (value === "yes" || value === "no") setChoice(value);
        }}
        className="sr-only"
      >
        <option value="" disabled>
          Choose one
        </option>
        <option value="yes">Yes</option>
        <option value="no">No</option>
      </select>

      <div className="grid gap-2.5 sm:grid-cols-2">
        <ChoiceCard
          selected={choice === "yes"}
          glyph={<Split />}
          title="Yes, one per client"
          body="Each client relationship keeps its own workspace."
          onSelect={() => setChoice("yes")}
        />
        <ChoiceCard
          selected={choice === "no"}
          glyph={<House />}
          title="No, one organization"
          body="Everything in a single workspace. You can turn this on later."
          onSelect={() => setChoice("no")}
        />
      </div>

      {choice === "" ? (
        <p className="text-[12.5px]" style={{ color: "var(--text-tertiary)" }}>
          Choose one to continue.
        </p>
      ) : null}

      {choice === "yes" ? children : null}
    </div>
  );
}

/**
 * One of the two answers, drawn as something you choose rather than as a box
 * with words in it.
 *
 * The mark on the left is a radio, because that is what this is: two answers,
 * one of them true. It was a plain bordered rectangle whose only sign of
 * being pressed was a slightly bluer background.
 */
function ChoiceCard({
  selected,
  glyph,
  title,
  body,
  onSelect,
}: {
  selected: boolean;
  glyph: React.ReactNode;
  title: string;
  body: string;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className="flex items-start gap-3 rounded-[12px] border px-4 py-3.5 text-left transition-all hover:-translate-y-px"
      style={{
        borderColor: selected ? "var(--accent)" : "var(--border-strong)",
        background: selected ? "var(--accent-tint)" : "var(--surface)",
        boxShadow: selected
          ? "0 0 0 1px var(--accent), 0 10px 22px -18px rgba(31,72,125,.8)"
          : "0 1px 2px rgba(31,72,125,.05)",
      }}
    >
      <span
        aria-hidden
        className="mt-[2px] flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border text-[10px] font-bold"
        style={{
          borderColor: selected ? "var(--accent)" : "var(--border-strong)",
          background: selected ? "var(--accent)" : "transparent",
          color: "#fff",
        }}
      >
        {selected ? "✓" : ""}
      </span>

      <span className="min-w-0">
        <span className="flex items-center gap-1.5 text-[14px] font-semibold">
          <span
            aria-hidden
            className="shrink-0"
            style={{ color: selected ? "var(--accent)" : "var(--text-tertiary)" }}
          >
            {glyph}
          </span>
          {title}
        </span>
        <span
          className="mt-1 block text-[12.5px] leading-[1.5]"
          style={{ color: "var(--text-secondary)" }}
        >
          {body}
        </span>
      </span>
    </button>
  );
}

/** Two panes: a workspace for each relationship. */
function Split() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden>
      <rect x="1.5" y="3" width="5.5" height="10" rx="1.4" stroke="currentColor" strokeWidth="1.3" />
      <rect x="9" y="3" width="5.5" height="10" rx="1.4" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  );
}

/** One roof over everything. */
function House() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M2.5 7 8 2.6 13.5 7v5.4a1 1 0 0 1-1 1h-9a1 1 0 0 1-1-1V7Z"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
    </svg>
  );
}
