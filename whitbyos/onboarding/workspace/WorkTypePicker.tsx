"use client";

import { useState } from "react";
import { OnboardingField } from "@/whitbyos/onboarding/components/OnboardingShell";

/**
 * 4.1's six. The list lost two — Concierge Services and Board & Executive
 * Services — because v2 does not draw them, and gained nothing.
 * "Something Else" stays: SRS §4.3.5 requires it.
 */
/** The one that asks for words rather than standing for them. */
const OTHER = "Something Else";

const WORK_TYPES = [
  "Family Office",
  "Relocation Services",
  "Wealth Management",
  "Real Estate",
  "Legal & Estate",
  "Something Else",
];

/**
 * A field on Step 2, not a step of its own.
 *
 * v2 folds this into Your Organization — "What kind of work do you coordinate?
 * (optional — personalizes playbooks)" — where it had been its own screen with
 * its own footer and its own skip. Being asked to press Continue on a question
 * that was optional was the odd part; as a field it is simply left alone.
 */
export function WorkTypePicker({ initial = [] }: { initial?: string[] }) {
  const [selected, setSelected] = useState<string[]>(initial);
  const [other, setOther] = useState("");

  function toggle(value: string) {
    setSelected((current) =>
      current.includes(value)
        ? current.filter((item) => item !== value)
        : [...current, value],
    );
  }

  const elsewhere = selected.includes(OTHER);

  return (
    <OnboardingField
      label="What kind of work do you coordinate?"
      hint="(optional, personalizes playbooks)"
    >
      {/*
       * Chips rather than a dropdown, because more than one of these is true
       * of most firms and a select would make somebody choose. Smaller than
       * they were — six buttons at 14px and 18px of padding took two rows and
       * a third of the card for a question that is optional.
       */}
      <div className="flex flex-wrap gap-2">
        {WORK_TYPES.map((type) => {
          const on = selected.includes(type);
          return (
            <button
              key={type}
              type="button"
              aria-pressed={on}
              onClick={() => toggle(type)}
              className="flex items-center gap-1.5 rounded-full px-3 py-[6px] text-[13px] font-medium transition-colors"
              style={{
                border: `1px solid ${on ? "var(--accent)" : "var(--border)"}`,
                background: on ? "var(--accent-tint)" : "transparent",
                color: on ? "var(--accent)" : "var(--text-secondary)",
              }}
            >
              {on ? <span aria-hidden>✓</span> : null}
              {type}
            </button>
          );
        })}
      </div>

      {/*
       * "Something Else" asked a question and then took no answer.
       *
       * §4.3.5 has it on the list so that a firm that is none of the five can
       * say so; a firm that says so and is not asked what they do has told
       * the product nothing it can use.
       */}
      {elsewhere ? (
        <input
          value={other}
          onChange={(event) => setOther(event.target.value)}
          maxLength={60}
          autoFocus
          placeholder="What kind of work is it?"
          aria-label="The kind of work you coordinate"
          className="mt-2 w-full rounded-control border px-3 py-[8px] text-[13.5px] outline-none placeholder:text-[rgba(55,53,47,0.35)]"
          style={{ borderColor: "var(--accent)", color: "var(--ink)" }}
        />
      ) : null}

      {/* The selections travel with the step's own submit. What somebody
          typed goes in place of "Something Else", because the words are the
          answer and the label was only the way of asking for them. */}
      {selected.map((type) =>
        type === OTHER ? null : (
          <input key={type} type="hidden" name="workType" value={type} />
        ),
      )}
      {elsewhere && other.trim() ? (
        <input type="hidden" name="workType" value={other.trim()} />
      ) : null}
    </OnboardingField>
  );
}
