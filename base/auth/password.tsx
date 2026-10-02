"use client";

import { CheckIcon } from "@/base/components/AuthIcons";

/**
 * What a password has to be, said once.
 *
 * Screen 3.2 lists three rules and ticks them as they are met. They were drawn
 * on the reset screen and nowhere else, and — more to the point — nothing
 * checked them: the form enforced `minLength={8}` alone, so "aaaaaaaa" ticked
 * one rule out of three and was accepted anyway. The list was decoration.
 *
 * Supabase is configured to accept six characters with no required classes, so
 * the product is the stricter of the two. That is the right way round, but it
 * only holds if the rules shown are the rules applied, which is why the check
 * and the list are the same array.
 */
export const PASSWORD_RULES = [
  { label: "At least 8 characters", test: (value: string) => value.length >= 8 },
  { label: "Contains a number", test: (value: string) => /[0-9]/.test(value) },
  { label: "Contains an uppercase letter", test: (value: string) => /[A-Z]/.test(value) },
] as const;

/** "at least 8 characters" / "a number" — a rule said as a thing the password lacks. */
function lack(label: string): string {
  return label.replace(/^Contains /, "").replace(/^At least/, "at least");
}

/** "a, b and c" — a list a person would read aloud, not a comma-separated dump. */
function andList(parts: string[]): string {
  if (parts.length <= 1) return parts.join("");
  return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}

/**
 * What is still wrong with this password, worded for the person. Null when it passes.
 *
 * Sign Up no longer draws the checklist, so this sentence is the only place the
 * rules are ever stated there. It names them rather than pointing at a list —
 * an earlier wording said "the requirements below", which was true only on the
 * one screen that still shows them.
 */
export function passwordProblem(value: string): string | null {
  if (!value) return "A password is needed.";
  const failed = PASSWORD_RULES.filter((rule) => !rule.test(value));
  if (failed.length === 0) return null;
  const missing = andList(failed.map((rule) => lack(rule.label)));
  return failed.length === PASSWORD_RULES.length
    ? `Use ${missing}.`
    : `That password still needs ${missing}.`;
}

export function passwordMeetsRules(value: string): boolean {
  return PASSWORD_RULES.every((rule) => rule.test(value));
}

/**
 * The checklist, ticking as it is typed.
 *
 * `idle` before anything has been typed, so a fresh form is not a wall of
 * crosses telling somebody off for a field they have not reached.
 */
export function PasswordRules({ value }: { value: string }) {
  const idle = value.length === 0;

  return (
    <ul className="flex flex-col gap-1.5" aria-label="Password requirements">
      {PASSWORD_RULES.map((rule) => {
        const met = rule.test(value);
        return (
          <li key={rule.label} className="flex items-center gap-2 leading-[18px]">
            <span
              className="flex h-[15px] w-[15px] shrink-0 items-center justify-center rounded-full transition-colors"
              style={{
                background: met ? "var(--success-bg)" : "transparent",
                border: met ? "none" : "1.5px solid var(--border-strong)",
                color: "var(--success-fg)",
              }}
              aria-hidden
            >
              {met ? <CheckIcon size={9} /> : null}
            </span>
            <span
              className="text-[12.5px] transition-colors"
              style={{
                color: met
                  ? "var(--ink)"
                  : idle
                    ? "var(--text-tertiary)"
                    : "var(--text-secondary)",
              }}
            >
              {rule.label}
            </span>
            <span className="sr-only">{met ? " — met" : " — not yet met"}</span>
          </li>
        );
      })}
    </ul>
  );
}
