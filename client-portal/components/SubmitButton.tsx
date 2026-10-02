"use client";

import { useFormStatus } from "react-dom";
import { Button } from "@/base/components/Button";
import { BUTTON_SIZE, type ButtonSize } from "./buttons";

/**
 * Submit control for the portal's server-action forms. Disables itself while the
 * action is in flight so a client cannot double-submit a request or a payment.
 *
 * `form` by default, because nearly every one of these is the foot of a dialog
 * or a settings pane. A submit inside a table row — Pay now, Request access —
 * says `row`.
 */
export function SubmitButton({
  children,
  pendingLabel,
  variant = "primary",
  size = "form",
  fullWidth,
  name,
  value,
  formAction,
}: {
  children: React.ReactNode;
  pendingLabel?: string;
  variant?: "primary" | "dark" | "secondary" | "ghost";
  size?: ButtonSize;
  fullWidth?: boolean;
  name?: string;
  value?: string;
  /** Lets one form carry two actions — Save draft and Submit on the same fields. */
  formAction?: (formData: FormData) => void | Promise<void>;
}) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant={variant}
      unsized
      className={BUTTON_SIZE[size]}
      fullWidth={fullWidth}
      disabled={pending}
      name={name}
      value={value}
      formAction={formAction}
    >
      {pending ? (pendingLabel ?? "Working…") : children}
    </Button>
  );
}
