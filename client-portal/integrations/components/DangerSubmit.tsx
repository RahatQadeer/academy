"use client";

import { useFormStatus } from "react-dom";
import {
  BUTTON_SIZE,
  DANGER_SOLID,
  DANGER_SOLID_STYLE,
} from "@/client-portal/components/buttons";

/** A destructive submit that disables itself while the action runs. */
export function DangerSubmit({
  children,
  pendingLabel,
}: {
  children: React.ReactNode;
  pendingLabel: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={`${DANGER_SOLID} ${BUTTON_SIZE.form}`}
      style={DANGER_SOLID_STYLE}
    >
      {pending ? pendingLabel : children}
    </button>
  );
}
