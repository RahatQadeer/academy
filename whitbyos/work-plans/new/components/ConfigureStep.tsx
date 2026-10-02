"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { Callout } from "@/base/components/Callout";
import { buildWithWhitby } from "@/whitbyos/work-plans/actions";
import {
  COMPLEXITIES,
  PLAN_SIZES,
  URGENCIES,
  estimateCredits,
} from "@/whitbyos/lib/plan-config-vocab";

const CONTROL =
  "w-full rounded-control border border-line-strong bg-surface px-3 py-[9px] text-[13.5px] text-ink";
const LABEL = "block text-[12.5px] font-medium text-[color:var(--text-tertiary)]";

type Option = { id: string; title: string };

/**
 * WP.4 — Configure, and WP.5 — Generating.
 *
 * One component, because they are one moment: drafting takes ten or twenty
 * seconds and this form is what is waiting on it. Splitting them would mean a
 * page that polls for something to finish, or a blank screen while it does.
 * `useFormStatus` knows when the submit is in flight, which is exactly when
 * WP.5 is what should be on screen.
 */
export function ConfigureStep({
  clientName,
  clientId,
  requests,
  name,
  error,
  attempt,
}: {
  /** Null where the plan is the firm's own work, filed under nobody. */
  clientName: string | null;
  clientId: string;
  requests: Option[];
  /** What WP.5 reports having read, counted before the form was submitted. */
  /** A name typed on WP.3, which would otherwise be lost on the way here. */
  name: string;
  error?: string;
  /** Changes on every failed attempt. See `Body`. */
  attempt?: string;
}) {
  const [complexity, setComplexity] = useState("moderate");
  const [size, setSize] = useState("standard");
  // WP.4 draws Urgency as a slider, so its value is an index into URGENCIES.
  const [urgency, onUrgency] = useState(1);

  return (
    <form action={buildWithWhitby} className="flex flex-1 flex-col">
      <input type="hidden" name="client_id" value={clientId} />
      {name ? <input type="hidden" name="name" value={name} /> : null}
      <Body
        clientName={clientName}
        requests={requests}
        error={error}
        attempt={attempt}
        complexity={complexity}
        size={size}
        urgency={urgency}
        onComplexity={setComplexity}
        onSize={setSize}
        onUrgency={onUrgency}
      />
    </form>
  );
}

function Body({
  clientName,
  requests,
  error,
  attempt,
  complexity,
  size,
  urgency,
  onComplexity,
  onSize,
  onUrgency,
}: {
  /** Null where the plan is the firm's own work, filed under nobody. */
  clientName: string | null;
  requests: Option[];
  error?: string;
  attempt?: string;
  complexity: string;
  size: string;
  /** An index into URGENCIES — WP.4 draws this one as a slider. */
  urgency: number;
  onComplexity: (value: string) => void;
  onSize: (value: string) => void;
  onUrgency: (value: number) => void;
}) {
  const { pending } = useFormStatus();

  /**
   * Once building starts, this screen stays up until the next one arrives.
   *
   * `pending` goes false the moment the action answers, but the answer is a
   * redirect and the router has not painted it yet — so for that gap React
   * drew the form again, and the form flashed back between the progress
   * screen and the plan. Latching it means the last thing the professional
   * sees before the plan is the thing that was building it.
   *
   * A failure comes back to this same page with a fresh `at` stamp, which is
   * what releases the latch. It is a stamp rather than the message because
   * the same failure twice is two attempts, and an unchanged message would
   * leave this screen up over a form that had already returned.
   */
  const [building, setBuilding] = useState(false);

  useEffect(() => {
    if (pending) setBuilding(true);
  }, [pending]);

  useEffect(() => {
    setBuilding(false);
  }, [attempt]);

  if (pending || building) return <Generating clientName={clientName} />;

  const estimate = estimateCredits(complexity, size);

  return (
    <div className="flex flex-1 items-start justify-center px-5 py-6 sm:px-8 sm:py-10 xl:px-10">
      {/* WP.4 is a card, not a column on the page: 640px, centred in the frame.
          The wizard's ground is the canvas now, so the card carries the same
          hairline lift the routes on WP.3 do.

          Inside it the controls sit in three named groups — what the work is,
          when it has to land, how big a plan to draft. They were one stack of
          eight fields, which reads as a form to get through rather than as
          three decisions; and Target Completion, which the whole schedule is
          calculated backwards from, was the smallest thing on the screen. */}
      <div
        className="my-auto flex w-full max-w-[640px] flex-col overflow-hidden rounded-card border border-line bg-surface"
        style={{ boxShadow: "0 1px 2px rgba(15,15,15,.04)" }}
      >
        <div className="flex flex-col gap-7 p-9">
          <div>
            <h1 className="mb-1 text-[21px] font-bold">Describe the Work Plan you need</h1>
            <p className="text-[13px]" style={{ color: "var(--text-muted)" }}>
              {clientName ? `For ${clientName}. ` : "Internal work, filed under no client. "}
              Whitby will use your workspace data, documents, contacts,
              providers and past Work Plans, to draft this one.
            </p>
          </div>

          {error ? <Callout tone="danger">{error}</Callout> : null}

          <Group title="The work">
            {/*
              * What to write, not what somebody else wrote.
              *
              * The placeholder was a finished sentence about a family moving
              * to London — four lines of somebody else's work, which reads as
              * a filled-in field until you look twice, and says nothing about
              * what this one wants. A placeholder is a prompt for the person,
              * so it asks for the three things the drafter actually needs and
              * the label says so in words rather than calling it a "Prompt".
              */}
            <label className="flex flex-col gap-1.5">
              <span className={LABEL}>What needs to happen?</span>
              <span className="text-[12.5px]" style={{ color: "var(--text-muted)" }}>
                In your own words: the outcome you want, anything already
                agreed or ruled out, and any date that matters.
              </span>
              <textarea
                name="prompt"
                required
                rows={4}
                className={`${CONTROL} resize-none`}
                placeholder="Start with the outcome: what has to be true when this is done, for whom, and by when."
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className={LABEL}>
                Link to Request{" "}
                <span className="font-normal" style={{ color: "var(--text-quiet)" }}>
                  (optional)
                </span>
              </span>
              <select name="request_id" defaultValue="" className={CONTROL}>
                <option value="">None, standalone Work Plan</option>
                {requests.map((request) => (
                  <option key={request.id} value={request.id}>
                    {request.title}
                  </option>
                ))}
              </select>
            </label>
          </Group>

          <Group title="The deadline">
            <label className="flex flex-col gap-1.5">
              <span className={LABEL}>Target Completion</span>
              <input type="date" name="target_date" className={`${CONTROL} max-w-[240px]`} />
              <span className="text-[12px]" style={{ color: "var(--text-tertiary)" }}>
                Every task is dated backwards from this day. Leave it empty and
                Whitby will estimate one from the work itself.
              </span>
            </label>

            <UrgencySlider value={urgency} onChange={onUrgency} />
          </Group>

          {/* Size first. It is the one dial on this screen that decides how
              much work lands on somebody, and it was last, under a heading
              that does not mention length, so it went unread. */}
          <Group title="The shape of the plan">
            <div className="flex flex-col gap-2">
              <span className={LABEL}>Plan Size</span>
              {/* One bordered box of rows with real radios, which is how the
                  reference draws it, three chips would lose the hint each
                  option carries. */}
              <div className="overflow-hidden rounded-control border border-line-strong">
                {PLAN_SIZES.map((option, index) => {
                  const on = size === option.value;
                  return (
                    <label
                      key={option.value}
                      className="flex cursor-pointer items-center gap-[9px] px-3 py-2 text-[12.5px]"
                      style={{
                        background: on ? "var(--accent-tint-mid)" : undefined,
                        color: on ? "var(--accent)" : undefined,
                        borderBottom:
                          index < PLAN_SIZES.length - 1 ? "1px solid var(--border)" : undefined,
                      }}
                    >
                      <input
                        type="radio"
                        name="plan_size"
                        value={option.value}
                        checked={on}
                        onChange={() => onSize(option.value)}
                        style={{ accentColor: "var(--accent)" }}
                      />
                      {option.label}, {option.hint}
                    </label>
                  );
                })}
              </div>
            </div>

            <Callout tone="warning" size={12.5}>
              Higher urgency sequences tasks tighter and flags more items for
              approval; complexity and plan size together control how many Work
              Streams and tasks Whitby drafts.
            </Callout>

<Radios
              label="Complexity"
              name="complexity"
              options={COMPLEXITIES}
              value={complexity}
              onChange={onComplexity}
            />
          </Group>
        </div>

        {/* The cost and the button belong together — what this run spends, and
            the control that spends it — on the card's own footer rather than
            floating one above the other at the end of the stack. */}
        <div
          className="flex flex-wrap items-center justify-between gap-4 px-9 py-5"
          style={{ borderTop: "1px solid var(--border)", background: "var(--surface-soft)" }}
        >
          <span className="text-[12.5px]" style={{ color: "var(--text-muted)" }}>
            Estimated cost:{" "}
            <strong style={{ color: "var(--ink)" }}>~{estimate} AI credits</strong>
            {/* The reference prints the cycle balance beside this — "6,200 of
                10,000 used". Nothing meters credits, so a balance here would be
                a number invented to fill the space. */}
            <Link
              href="/whitbyos/settings/billing?credits=1"
              className="ml-2.5 font-medium no-underline"
              style={{ color: "var(--accent)" }}
            >
              Buy more credits
            </Link>
          </span>

          <button
            type="submit"
            className="pa-generate rounded-control px-[18px] py-[11px] text-[14px] font-medium text-white"
            style={{ background: "var(--accent)" }}
          >
            Generate Work Plan →
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * One decision on WP.4, under a name for it.
 *
 * The rule beside the heading is what separates the groups — a full divider
 * between them would draw three boxes inside a box.
 */
function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center gap-2.5">
        <h2
          className="text-[10.5px] font-semibold uppercase tracking-[.06em]"
          style={{ color: "var(--text-tertiary)" }}
        >
          {title}
        </h2>
        <span className="h-px flex-1" style={{ background: "var(--border)" }} aria-hidden />
      </div>
      {children}
    </section>
  );
}

/**
 * WP.4's Complexity — three chips, one chosen.
 *
 * A radio group in a coat: the inputs are real and named, so the value posts
 * with the form and the keyboard moves between them, while the chips carry the
 * reference's own colours.
 */
function Radios({
  label,
  name,
  options,
  value,
  defaultValue,
  onChange,
}: {
  label: string;
  name: string;
  options: { value: string; label: string }[];
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
}) {
  const controlled = value !== undefined;

  return (
    <div className="flex flex-col gap-2">
      <span className={LABEL}>{label}</span>
      <div className="flex gap-2">
        {options.map((option) => {
          const on = controlled && value === option.value;
          return (
            <label
              key={option.value}
              className="flex-1 cursor-pointer rounded-control px-2.5 py-[9px] text-center text-[12.5px] font-medium"
              style={
                on
                  ? {
                      // The reference outlines the chosen chip in the accent at
                      // a fifth of its strength, so the tint reads as filled
                      // rather than as a second, heavier border.
                      border: "1.5px solid rgba(35,131,226,.2)",
                      background: "var(--accent-tint)",
                      color: "var(--accent)",
                    }
                  : {
                      border: "1px solid var(--border-strong)",
                      background: "var(--surface)",
                      color: "rgba(55,53,47,.55)",
                    }
              }
            >
              <input
                type="radio"
                name={name}
                value={option.value}
                {...(controlled
                  ? { checked: on, onChange: () => onChange?.(option.value) }
                  : { defaultChecked: defaultValue === option.value })}
                className="sr-only"
              />
              {option.label}
            </label>
          );
        })}
      </div>
    </div>
  );
}

/**
 * One quiet screen between pressing Build and the plan's own page opening.
 *
 * Drafting runs behind the professional (`buildWithWhitby` / `after`), so this
 * is only the hand-off moment — the longer wait lives on `StillDrafting`.
 */
function Generating({ clientName }: { clientName: string | null }) {
  return (
    <div
      className="relative flex flex-1 flex-col items-center justify-center overflow-hidden px-10 py-16"
      style={{
        background:
          "radial-gradient(ellipse 70% 55% at 50% 28%, color-mix(in srgb, var(--accent) 10%, transparent), transparent 70%), var(--surface)",
      }}
    >
      <div className="relative z-[1] max-w-[400px] text-center">
        <span
          className="relative mx-auto mb-6 flex h-[52px] w-[52px] items-center justify-center rounded-[15px]"
          style={{
            background: "var(--accent-tint)",
            boxShadow: "0 0 0 1px color-mix(in srgb, var(--accent) 18%, transparent)",
          }}
          aria-hidden
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" className="animate-spin">
            <circle
              cx="12"
              cy="12"
              r="9"
              stroke="color-mix(in srgb, var(--accent) 25%, transparent)"
              strokeWidth="2.5"
            />
            <path
              d="M21 12a9 9 0 0 0-9-9"
              stroke="var(--accent)"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
          </svg>
        </span>

        <p
          className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em]"
          style={{ color: "var(--accent)" }}
        >
          Drafting
        </p>

        <h2
          className="text-balance text-[22px] font-bold tracking-[-0.03em] leading-[1.25]"
          style={{ color: "var(--ink)" }}
        >
          {clientName ? `Plan for ${clientName}` : "Your plan"}
        </h2>

        <p
          className="mt-3 text-pretty text-[13.5px] leading-[1.6]"
          style={{ color: "var(--text-secondary)" }}
        >
          Whitby is starting the draft. This page will open the plan when the
          first pieces are ready.
        </p>

        <div
          role="progressbar"
          aria-label="Starting the draft"
          className="mx-auto mt-8 h-[3px] w-full max-w-[280px] overflow-hidden rounded-full"
          style={{ background: "var(--surface-active)" }}
        >
          <div
            className="pa-progress-indeterminate h-full rounded-full"
            style={{ background: "var(--accent)" }}
          />
        </div>
      </div>
    </div>
  );
}

function UrgencySlider({
  value,
  onChange,
}: {
  value: number;
  onChange: (value: number) => void;
}) {
  const fill = (value / (URGENCIES.length - 1)) * 100;

  return (
    <div className="flex flex-col gap-2.5">
      <span className={LABEL}>Urgency</span>

      <input type="hidden" name="urgency" value={URGENCIES[value].value} />

      <div className="px-0.5 pt-2.5">
        <input
          type="range"
          min={0}
          max={URGENCIES.length - 1}
          step={1}
          value={value}
          onChange={(event) => onChange(Number(event.target.value))}
          aria-label="Urgency"
          aria-valuetext={URGENCIES[value].label}
          className="pa-slider"
          style={{ ["--fill" as string]: `${fill}%` }}
        />

        {/* The words are targets too. Four labelled stops sitting under a
            slider look like the way to choose one, and dragging a 16px thumb
            to land on "High" is the hard way to do what reading the word
            already told you. `type="button"` matters — inside a form, a bare
            button submits it. */}
        <div className="-mx-1.5 mt-1.5 flex justify-between">
          {URGENCIES.map((option, index) => (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(index)}
              aria-pressed={index === value}
              className="pa-slider-stop rounded-[5px] px-1.5 py-1 text-[11.5px]"
              style={
                index === value
                  ? { color: "var(--accent)", fontWeight: 600 }
                  : { color: "var(--text-faint)" }
              }
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
