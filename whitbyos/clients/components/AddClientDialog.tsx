"use client";

import { useState } from "react";
import { Button } from "@/base/components/Button";
import { Submit } from "@/base/components/Submit";
import { Callout } from "@/base/components/Callout";
import { cn } from "@/base/lib/cn";
import { checkEmail } from "@/base/auth/email";
import { Modal } from "@/whitbyos/components/Modal";
import { CONTROL, Field } from "@/whitbyos/components/Field";
import { PhoneField } from "@/whitbyos/onboarding/account/PhoneField";
import { createClientRecord } from "@/whitbyos/clients/actions";
import { classificationsForCreate } from "@/whitbyos/lib/format";

export function AddClientDialog({
  closeHref,
  error,
  classifications,
  returnTo,
}: {
  closeHref: string;
  error?: string;
  /**
   * Where a refusal comes back to, when it is not the Clients list.
   *
   * The dialog opens on two screens now — the list, and Workspace Overview,
   * which is where somebody is standing when they decide there should be
   * another client. A missing name used to send them to the other one.
   */
  returnTo?: string;
  /**
   * Unused for the options themselves. Callers still pass Settings values;
   * the dropdown is the documented list (Individual, Family, Household,
   * Company, Organization). Estate was an old default, not in the SRS.
   */
  classifications?: string[];
}) {
  const options = classificationsForCreate();
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [emailHint, setEmailHint] = useState<string | null>(null);

  function validateEmail(value: string) {
    const next = value.trim();
    if (!next) {
      setEmailError("Enter their email address.");
      setEmailHint(null);
      return false;
    }
    const checked = checkEmail(next);
    if (!checked.ok) {
      setEmailError(checked.reason);
      setEmailHint(null);
      return false;
    }
    setEmailError(null);
    setEmailHint(checked.suggestion ? `Did you mean ${checked.suggestion}?` : null);
    return true;
  }

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    if (!validateEmail(email)) event.preventDefault();
  }

  return (
    <Modal title="Create Workspace" closeHref={closeHref}>
      <form
        action={createClientRecord}
        onSubmit={onSubmit}
        className="flex flex-col gap-4"
      >
        {returnTo ? <input type="hidden" name="return_to" value={returnTo} /> : null}
        {error ? <Callout tone="danger">{error}</Callout> : null}

        <Field label="Workspace" htmlFor="name" required>
          <input
            id="name"
            name="name"
            required
            minLength={2}
            maxLength={80}
            placeholder="Enter name"
            className={CONTROL}
          />
        </Field>

        <Field label="Classification" htmlFor="classification" required>
          <select
            id="classification"
            name="classification"
            required
            defaultValue=""
            className={CONTROL}
          >
            <option value="">Select classification</option>
            {options.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Contact person" htmlFor="contact_name" required>
          <input
            id="contact_name"
            name="contact_name"
            required
            minLength={2}
            maxLength={80}
            placeholder="Enter name"
            className={CONTROL}
          />
        </Field>

        <Field label="Contact Email" htmlFor="contact_email" required>
          <input
            id="contact_email"
            name="contact_email"
            type="email"
            inputMode="email"
            autoComplete="email"
            spellCheck={false}
            required
            maxLength={120}
            placeholder="Enter email"
            value={email}
            aria-invalid={emailError ? true : undefined}
            aria-describedby={
              emailError ? "contact_email_error" : "contact_email_note"
            }
            onChange={(event) => {
              setEmail(event.target.value);
              if (emailError) validateEmail(event.target.value);
            }}
            onBlur={(event) => validateEmail(event.target.value)}
            className={cn(CONTROL, emailError && "border-[var(--danger-text,#c4554d)]")}
          />
        </Field>

        {emailError ? (
          <p
            id="contact_email_error"
            className="-mt-2 text-[12.5px]"
            style={{ color: "var(--danger-text)" }}
          >
            {emailError}
          </p>
        ) : (
          <p
            id="contact_email_note"
            className="-mt-2 text-[12.5px]"
            style={{ color: "var(--text-tertiary)" }}
          >
            {emailHint ?? "We'll use this to reach them."}
          </p>
        )}

        <Field label="Phone" htmlFor="contact_phone" hint="(optional)">
          <PhoneField id="contact_phone" name="contact_phone" className={CONTROL} />
        </Field>

        <div className="mt-1 flex justify-end gap-2.5">
          <Button unsized href={closeHref} variant="secondary" className="px-4 py-[9px] text-[14px]">
            Cancel
          </Button>
          <Submit unsized variant="primary" className="px-[18px] py-[9px] text-[14px]">
            {/* The mark this product puts in front of anything that makes a
                new record: the dropdown's own "+ Create workspace", Quick
                Add, "+ Add task", "+ Add Work Stream". This was the one
                create button without it. */}
            + Create Workspace
          </Submit>
        </div>
      </form>
    </Modal>
  );
}
