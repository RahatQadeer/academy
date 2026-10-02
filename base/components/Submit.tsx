"use client";

import { useFormStatus } from "react-dom";
import { useEffect, useState, type ButtonHTMLAttributes, type MouseEvent, type Ref } from "react";
import { Button } from "@/base/components/Button";
import { cn } from "@/base/lib/cn";

/**
 * Whether *this* button should show the spinner while its form is busy.
 *
 * `useFormStatus` reports the form, not the button, so every submit inside one
 * form spins together. That is right for the form's own submit and wrong for
 * the secondary ones: a list with a remove button on each of twenty rows lit
 * up twenty spinners the moment somebody pressed Send, as though all twenty
 * were doing something.
 *
 * A button carrying `formAction` is a secondary one by definition — it sends
 * the form somewhere other than where the form says — so those spin only when
 * they were the button pressed. The form's own submit keeps spinning on any
 * submit, including one from the Enter key, which no click would have caught.
 */
function useBusy(formAction: unknown) {
  const { pending } = useFormStatus();
  const [pressed, setPressed] = useState(false);

  useEffect(() => {
    if (!pending && pressed) setPressed(false);
  }, [pending, pressed]);

  return {
    pending,
    busy: pending && (pressed || !formAction),
    press: () => setPressed(true),
  };
}

/**
 * A submit button that says it is working.
 *
 * A form posting to a server action gives no sign of life on its own: the
 * button stays pressable, nothing moves, and the only way to know anything
 * happened is that the screen eventually changes. On a slow connection that
 * reads as a dead button, and people press it again.
 *
 * `useFormStatus` reports the state of the form this sits inside, so nothing
 * has to be passed down and no caller has to hold state. It only works from
 * inside the form, which is why this is its own component rather than a flag
 * on Button.
 */
export function Submit({
  children,
  className,
  variant = "primary",
  unsized,
  fullWidth,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "dark" | "secondary" | "ghost";
  unsized?: boolean;
  fullWidth?: boolean;
}) {
  const { pending, busy, press } = useBusy(props.formAction);

  return (
    <Button
      {...props}
      type="submit"
      variant={variant}
      unsized={unsized}
      fullWidth={fullWidth}
      disabled={pending || props.disabled}
      aria-busy={busy}
      onClick={(event: MouseEvent<HTMLButtonElement>) => {
        press();
        props.onClick?.(event);
      }}
      className={cn("gap-2", className)}
    >
      {busy ? <Spinner /> : null}
      {children}
    </Button>
  );
}

/**
 * The same, for a button that carries its own styling.
 *
 * Half the submits in the product are plain elements with their own classes:
 * text links, icon buttons, danger buttons. Wrapping those in Button would
 * restyle them, so this only adds the two things that were missing, a spinner
 * and a lock against a second press, and leaves everything else alone.
 */
export function SubmitPlain({
  children,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  /**
   * React 19 passes a ref as an ordinary prop, and it is spread onto the
   * button below with the rest of them. Typed here because
   * `ButtonHTMLAttributes` does not carry it, and a caller that wants to
   * press this button from a keystroke elsewhere needs to hold it.
   */
  ref?: Ref<HTMLButtonElement>;
}) {
  const { pending, busy, press } = useBusy(props.formAction);

  return (
    <button
      {...props}
      type="submit"
      disabled={pending || props.disabled}
      aria-busy={busy}
      onClick={(event) => {
        press();
        props.onClick?.(event);
      }}
      className={cn(className, busy && "opacity-60")}
    >
      {/*
       * Beside the label, not above it.
       *
       * A plain submit brings its own classes and most of them are not flex,
       * so the spinner had nothing holding it on the line — and preflight
       * makes an `svg` a block, which put it on its own line and pushed the
       * word underneath. `Submit` never showed this because Button is
       * inline-flex; this one has to say it itself.
       */}
      {busy ? (
        <span className="mr-1.5 inline-block align-[-2px]">
          <Spinner />
        </span>
      ) : null}
      {children}
    </button>
  );
}

/**
 * The same ring the sidebar spins while a page loads, so waiting looks the
 * same wherever it happens. `currentColor`, so it works on a filled button
 * and an outlined one without being told which it is on.
 */
export function Spinner() {
  return (
    <svg
      viewBox="0 0 16 16"
      width="13"
      height="13"
      // `inline-block` rather than preflight's `display: block`, so this works
      // in a line of text as well as in a flex row.
      className="inline-block shrink-0 animate-spin align-[-2px]"
      aria-hidden
    >
      <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="2" opacity=".25" />
      <path
        d="M8 2a6 6 0 0 1 6 6"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}
