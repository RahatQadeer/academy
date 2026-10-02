"use client";

import { useEffect, useRef, useState } from "react";
import { CONTROL, Field } from "@/whitbyos/components/Field";
import type { CompanyOption } from "@/whitbyos/lib/providers";

/**
 * The name, and what the firm already has under it.
 *
 * There used to be a dropdown above this asking whether the company was on
 * file, which is a question nobody can answer before they have typed the name
 * and one they have to answer every single time to say "no". So it is gone,
 * and the answer arrives on its own: type a name the firm already holds and
 * it says so, right there, once it matters.
 *
 * Matching an existing company links to it rather than making a second row —
 * `companies` is base's, shared with Clients, Contacts and the Partner Center,
 * and two rows for one firm split its work between them.
 */
export function ProviderNameField({
  label,
  placeholder,
  companies,
  defaultValue,
}: {
  label: string;
  placeholder: string;
  companies: CompanyOption[];
  defaultValue?: string;
}) {
  const [name, setName] = useState(defaultValue ?? "");
  const [company, setCompany] = useState(true);
  const box = useRef<HTMLDivElement>(null);

  // A person of the same name as a company is a coincidence, not a match.
  useEffect(() => {
    const form = box.current?.closest("form");
    if (!form) return;
    const read = () => {
      const type = form.elements.namedItem("type") as RadioNodeList | null;
      setCompany(type?.value !== "individual");
    };
    read();
    form.addEventListener("change", read);
    return () => form.removeEventListener("change", read);
  }, []);

  const typed = name.trim().toLowerCase();
  const match =
    company && typed
      ? (companies.find((option) => option.name.toLowerCase() === typed) ?? null)
      : null;

  return (
    <div ref={box}>
      <Field label={label} htmlFor="name" required>
        {/* Empty unless the name is one the firm already holds, in which case
            the provider hangs off that company instead of a new one. */}
        <input type="hidden" name="company_id" value={match && !match.isProvider ? match.id : ""} />
        <input
          id="name"
          name="name"
          required
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder={placeholder}
          autoComplete="off"
          className={CONTROL}
        />

        {match ? (
          <p
            className="text-[12px] leading-[1.5]"
            style={{
              margin: "6px 0 0",
              color: match.isProvider ? "var(--danger-text)" : "var(--text-tertiary)",
            }}
          >
            {match.isProvider
              ? `${match.name} is already a provider. Open them from the directory instead of adding them again.`
              : `${match.name} is already on file. This will be added to that company rather than creating a second one.`}
          </p>
        ) : null}
      </Field>
    </div>
  );
}
