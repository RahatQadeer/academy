import Link from "next/link";
import { Logo } from "@/base/components/Logo";

/**
 * Five, since v2 of the reference. It reads "Step 1 of 5 · Account" through
 * "Step 5 of 5 · Team", so each step names itself rather than being a number
 * alone — a bar of five dots says how far along somebody is, and the word says
 * what they are actually being asked for.
 */
export const TOTAL_STEPS = 5;

export const STEP_NAMES = [
  "Account",
  "Organization",
  "Workspace",
  "Plan",
  "Team",
];

const DEFAULT_EXIT = (
  <Link
    href="/switcher"
    className="inline-flex items-center rounded-control border border-line-strong bg-surface px-3.5 py-[7px] text-[13px] font-semibold no-underline shadow-[0_1px_0_rgba(255,255,255,.8)] transition-colors hover:bg-[var(--accent-tint)] hover:!text-ink"
    style={{ color: "var(--ink)" }}
  >
    Save &amp; exit
  </Link>
);

/**
 * Frame shared by all four professional onboarding screens, matching the
 * Professional Figma: fixed 76px header, four-segment progress bar, centred
 * card, and a fixed 88px action bar.
 *
 * Branding is Private Attaché, not Whitby — the app shell owns auth and
 * onboarding (SRS §1.1). "Whitby" appears only in the final call to action.
 *
 * `footer` sits in the bottom bar. Pages that submit wrap this whole component
 * in their <form>, so the submit button in the bar drives the fields in the card.
 *
 * `step` may be null for a first-run screen that is not one of the four — the
 * photo step an invited teammate lands on has no place in a founder's progress
 * bar, and drawing one would tell them they are three steps behind on a setup
 * they were never doing. `exit` may be null for the same reason: there is
 * nothing to save and exit from.
 */
export type OnboardingWorkspace = {
  name: string;
  logoUrl: string | null;
};

export function OnboardingShell({
  step,
  title,
  subtitle,
  width = 560,
  workspace,
  centeredHeader,
  exit = DEFAULT_EXIT,
  footer,
  children,
  lockHeight = false,
}: {
  /** Null on a one-off screen, which draws no progress bar. */
  step: number | null;
  title: string;
  subtitle?: string;
  width?: number;
  /** Shown top-right once the workspace exists, from step 2 onward. */
  workspace?: OnboardingWorkspace | null;
  centeredHeader?: React.ReactNode;
  /** Top-right escape hatch. Null where there is nothing to come back to. */
  exit?: React.ReactNode;
  footer: React.ReactNode;
  children?: React.ReactNode;
  /**
   * Keep the step on one screen. The plan picker is five tall cards and
   * used to push the actions off the page, which made choosing a plan feel
   * longer than it is.
   */
  lockHeight?: boolean;
}) {
  return (
    /*
     * Setting up is the first thing anybody sees of this product, and it was
     * grey paper on a grey wall: a white card on #f1f1ef, five grey dashes,
     * and one blue button at the bottom. The ground carries the product's own
     * blue now, lightly and from the top, so the card reads as a sheet on a
     * desk rather than as a form on a wall.
     */
    <div
      className={lockHeight ? "relative flex h-screen flex-col overflow-hidden" : "relative min-h-screen overflow-hidden"}
      style={{
        background:
          "linear-gradient(180deg, #eaf2fc 0%, #f3f8fd 38%, #ffffff 100%)",
      }}
    >
      {/*
       * Two soft lights on the wall behind the card.
       *
       * The wash was one faint tint over a near-white and came out as the
       * grey it was trying not to be. These are colour: the product's blue
       * over the shoulder and a warmer one low down, both far enough out of
       * focus to stay behind the reading.
       */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(760px 340px at 12% -8%, rgba(35,131,226,.26) 0%, rgba(35,131,226,0) 68%), radial-gradient(680px 320px at 88% 6%, rgba(13,63,118,.18) 0%, rgba(13,63,118,0) 70%), radial-gradient(900px 420px at 50% 112%, rgba(35,131,226,.14) 0%, rgba(35,131,226,0) 72%)",
        }}
      />

      <header
        className={`relative flex items-center justify-between px-10 backdrop-blur-[6px] sm:px-16 ${lockHeight ? "h-[56px] shrink-0" : "h-[68px]"}`}
        style={{
          background: "rgba(255,255,255,.82)",
          borderBottom: "1px solid rgba(31,72,125,.12)",
          boxShadow: "0 1px 0 rgba(255,255,255,.7) inset, 0 8px 24px -22px rgba(31,72,125,.9)",
        }}
      >
        <div className="flex items-center gap-2.5">
          <Logo size={26} className="overflow-hidden rounded-control" />
          <span className="text-[14.5px] font-semibold tracking-[-0.2px]">
            Private Attaché
          </span>
        </div>

        <div className="flex items-center gap-4">
          {workspace ? (
            <div className="flex items-center gap-2">
              {workspace.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={workspace.logoUrl}
                  alt={`${workspace.name} logo`}
                  className="h-[26px] w-[26px] rounded-[8px] border border-line object-cover"
                />
              ) : null}
              <span className="max-w-[200px] truncate text-[13.5px] font-medium">
                {workspace.name}
              </span>
            </div>
          ) : null}

          {exit}
        </div>
      </header>

      {step === null ? null : (
        <div className={`relative flex flex-col items-center gap-1.5 ${lockHeight ? "shrink-0 pt-3" : "pt-5"}`}>
          {/* Done, here, and ahead — three states rather than two, so the bar
              says where somebody is standing and not only how far they have
              come. */}
          <div className="flex w-[480px] max-w-full gap-1.5 px-6">
            {Array.from({ length: TOTAL_STEPS }, (_, index) => {
              const done = index < step - 1;
              const here = index === step - 1;

              return (
                <span
                  key={index}
                  className="h-[5px] flex-1 rounded-full transition-colors"
                  style={{
                    background: done
                      ? "var(--accent)"
                      : here
                        ? "linear-gradient(90deg, var(--accent) 0%, rgba(35,131,226,.35) 100%)"
                        : "var(--border)",
                  }}
                />
              );
            })}
          </div>
          <span
            className="rounded-full px-2.5 py-[3px] text-[11.5px] font-semibold"
            style={{ background: "var(--accent-tint)", color: "var(--accent)" }}
          >
            Step {step} of {TOTAL_STEPS}
            {STEP_NAMES[step - 1] ? ` · ${STEP_NAMES[step - 1]}` : ""}
          </span>
        </div>
      )}

      {/* Tight enough to stand on one screen: setting up is five short
          steps, and a step somebody has to scroll to finish reads as longer
          than it is. */}
      <div
        className={
            lockHeight ? "relative flex min-h-0 flex-1 items-center justify-center px-6 py-4"
            : "relative flex justify-center px-6 pb-8 pt-6"
        }
      >
        <div
          className={`pa-onboarding-card w-full rounded-[16px] border bg-surface ${lockHeight ? "flex max-h-full flex-col overflow-visible p-6" : "overflow-hidden p-7"}`}
          style={{
            maxWidth: width,
            borderColor: "var(--chrome-line)",
            boxShadow:
              "0 1px 2px rgba(31,72,125,.06), 0 24px 48px -32px rgba(31,72,125,.55)",
          }}
        >
          <div className={`flex min-h-0 flex-col ${lockHeight ? "gap-4" : "gap-[13px]"}`}>
            {centeredHeader ?? (
              <div className="shrink-0">
                <h1 className={`mb-1 font-bold tracking-[-0.3px] ${lockHeight ? "text-[20px]" : "text-[22px]"}`}>
                  {title}
                </h1>
                {subtitle ? (
                  <p
                    className={lockHeight ? "text-[13px] leading-snug" : "text-[14px]"}
                    style={{ color: "var(--text-secondary)" }}
                  >
                    {subtitle}
                  </p>
                ) : null}
              </div>
            )}
            <div className={lockHeight ? "flex min-h-0 flex-1 flex-col overflow-visible p-0.5" : undefined}>
              {children}
            </div>

            <div
              className={`shrink-0 ${lockHeight ? "border-t pt-3" : "mt-1 border-t pt-4"}`}
              style={{ borderColor: "var(--border)" }}
            >
              {footer}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Label-above-control field, matching the onboarding card. */
export function OnboardingField({
  label,
  hint,
  note,
  htmlFor,
  required,
  children,
  className,
}: {
  label: string;
  /** Sits inside the label, lighter — 4's "(optional)". */
  hint?: string;
  /** Sits under the control — 4's "PNG or JPG, up to 2MB". */
  note?: string;
  htmlFor?: string;
  /**
   * Marks the label, and says so in words to a screen reader.
   *
   * On the control itself `required` only speaks when somebody presses the
   * button; the star is what lets them see, before they start, which of the
   * five things in front of them they cannot leave.
   */
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex flex-col gap-1.5 ${className ?? ""}`}>
      <label
        htmlFor={htmlFor}
        className="text-[12.5px] font-medium"
        style={{ color: "var(--text-tertiary)" }}
      >
        {label}
        {required ? (
          <span style={{ color: "var(--danger-fg)" }}>
            {" "}
            *<span className="sr-only"> required</span>
          </span>
        ) : null}
        {hint ? (
          <span className="font-normal" style={{ color: "var(--text-quiet)" }}>
            {" "}
            {hint}
          </span>
        ) : null}
      </label>
      {children}
      {note ? (
        <span className="text-[11.5px]" style={{ color: "var(--text-quiet)" }}>
          {note}
        </span>
      ) : null}
    </div>
  );
}

export const ONBOARDING_CONTROL =
  /* `pa-onboarding-control` carries the focus ring and the file button, which
     are pseudo-states no inline style can reach — see globals. */
  "pa-onboarding-control w-full rounded-control border border-line-strong bg-surface px-3 py-[9px] text-[14.5px] text-ink placeholder:text-[rgba(55,53,47,0.35)]";
