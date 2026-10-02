"use client";

import { useState } from "react";
import { Button } from "@/base/components/Button";
import { Submit } from "@/base/components/Submit";
import { Callout } from "@/base/components/Callout";
import { cn } from "@/base/lib/cn";
import { Modal } from "@/whitbyos/components/Modal";
import { createContact } from "@/whitbyos/contacts/actions";
import { RELATIONSHIP_OPTIONS } from "@/whitbyos/lib/contact-vocab";
import type { ClientOption } from "@/whitbyos/lib/requests";

const FIELD =
  "w-full rounded-control border border-line-strong bg-surface px-3 py-[9px] text-[13.5px] text-ink outline-none transition-[border-color,box-shadow] placeholder:text-[rgba(55,53,47,0.35)] focus:border-[var(--accent)] focus:shadow-[0_0_0_3px_var(--accent-tint)]";

/**
 * Screen 4.5 — Add Contact or Company.
 *
 * The segmented control at the top is what makes this one dialog rather than
 * two: a person and a company are both relationship records, and which one you
 * are adding is usually decided while the dialog is already open.
 *
 * A client is chosen alongside the relationship label because that label
 * describes a link, not a person — "Authorized User" is only true of someone in
 * relation to a particular client.
 */
export function AddContactDialog({
  clients,
  defaultClientId,
  closeHref,
  error,
}: {
  clients: ClientOption[];
  /** The client workspace that is open, if one is — pre-fills Linked Client. */
  defaultClientId?: string | null;
  closeHref: string;
  error?: string;
}) {
  const [kind, setKind] = useState<"person" | "company">("person");
  const person = kind === "person";

  return (
    <Modal
      title={person ? "Add Contact" : "Add Company"}
      closeHref={closeHref}
      width={440}
      dense
      headerGap={16}
      titleSize={17}
    >
      <div style={{ caretColor: "transparent" }}>
        <p
          className="mb-4 text-[12.5px] leading-[1.5]"
          style={{ color: "var(--text-tertiary)" }}
        >
          {person
            ? "A person on file. Link them to a client when you need to."
            : "A company on file: firm or organisation."}
        </p>

        <div
          className="mb-5 flex gap-1 rounded-control border p-[3px]"
          style={{
            background: "var(--surface-soft)",
            borderColor: "var(--chrome-line)",
          }}
          role="radiogroup"
          aria-label="What are you adding?"
        >
          {(["person", "company"] as const).map((option) => {
            const chosen = option === kind;
            return (
              <button
                key={option}
                type="button"
                role="radio"
                aria-checked={chosen}
                onClick={() => setKind(option)}
                className={cn(
                  "flex-1 rounded-[5px] py-[7px] text-center text-[13px] capitalize outline-none",
                  chosen ? "font-semibold" : "font-medium",
                )}
                style={{
                  background: chosen ? "var(--surface)" : "transparent",
                  color: chosen ? "var(--ink)" : "var(--text-secondary)",
                  boxShadow: chosen ? "0 1px 2px rgba(31,72,125,.08)" : undefined,
                  caretColor: "transparent",
                  cursor: "pointer",
                }}
              >
                {option}
              </button>
            );
          })}
        </div>

        <form action={createContact} className="flex flex-col gap-3.5">
          <input type="hidden" name="kind" value={kind} />

          {error ? <Callout tone="danger">{error}</Callout> : null}

          <Field label={person ? "Full Name" : "Company Name"} htmlFor="name">
            <input
              id="name"
              name="name"
              required
              autoFocus
              placeholder={person ? "Enter name" : "Enter company name"}
              className={FIELD}
              style={{ caretColor: "auto", cursor: "text" }}
            />
          </Field>

          {person ? (
            <Field label="Email" htmlFor="email">
              <input
                id="email"
                name="email"
                type="email"
                placeholder="Enter email"
                className={FIELD}
                style={{ caretColor: "auto", cursor: "text" }}
              />
            </Field>
          ) : null}

          <Field label={person ? "Company / Role" : "Category"} htmlFor="title_role">
            <input
              id="title_role"
              name="title_role"
              placeholder={person ? "Enter company / role" : "Enter category"}
              className={FIELD}
              style={{ caretColor: "auto", cursor: "text" }}
            />
          </Field>

          {person ? (
            <>
              <Field label="Relationship Label" htmlFor="role">
                {/*
                 * `rounded-control` is what draws the chevron with room beside
                 * the value — without it the native arrow sits on the text.
                 */}
                <select
                  id="role"
                  name="role"
                  defaultValue="authorized_user"
                  className={FIELD}
                  style={{ caretColor: "transparent", cursor: "pointer" }}
                >
                  {RELATIONSHIP_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </Field>

              {clients.length > 0 ? (
                <Field label="Linked Client (optional)" htmlFor="client_id">
                  <select
                    id="client_id"
                    name="client_id"
                    defaultValue={defaultClientId ?? ""}
                    className={FIELD}
                    style={{ caretColor: "transparent", cursor: "pointer" }}
                  >
                    <option value="">Not linked yet</option>
                    {clients.map((client) => (
                      <option key={client.id} value={client.id}>
                        {client.name}
                      </option>
                    ))}
                  </select>
                </Field>
              ) : null}
            </>
          ) : null}

          <div
            className="mt-1 flex justify-end gap-2.5 border-t pt-4"
            style={{ borderColor: "var(--chrome-line)" }}
          >
            <Button unsized href={closeHref} variant="secondary" className="px-4 py-[9px] text-[13.5px]">
              Cancel
            </Button>
            <Submit unsized variant="primary" className="px-[18px] py-[9px] text-[13.5px]">
              {person ? "Add Contact" : "Add Company"}
            </Submit>
          </div>
        </form>
      </div>
    </Modal>
  );
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label
        htmlFor={htmlFor}
        className="mb-1.5 block text-[12px] font-medium"
        style={{ color: "var(--text-secondary)", caretColor: "transparent", cursor: "default" }}
      >
        {label}
      </label>
      {children}
    </div>
  );
}
