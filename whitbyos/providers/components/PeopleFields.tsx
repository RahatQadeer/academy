"use client";

import { useEffect, useRef, useState } from "react";
import { CONTROL, Field } from "@/whitbyos/components/Field";

/**
 * The people at the company being added, filled in while it is being added.
 *
 * A provider is a firm and a firm is people. Asking for the company first and
 * the people later means going to Contacts, adding them one at a time, coming
 * back and picking one — which is why providers in this directory have a
 * company and nobody to ring.
 *
 * Rows are added as they are needed rather than drawn three deep and left
 * empty. Every field is optional: a name is enough, and a firm nobody has a
 * name at yet is still worth filing.
 */
type Row = { key: number; name: string; role: string; email: string; phone: string };

let nextKey = 1;
const blank = (): Row => ({ key: nextKey++, name: "", role: "", email: "", phone: "" });

export function PeopleFields({
  firms = [],
  atFirm,
}: {
  firms?: { id: string; name: string }[];
  /**
   * The firm this is being added from, when it is being added from one.
   *
   * Then "Independent, not at a firm" is not an option: somebody filed from
   * inside a firm is at that firm, and offering the opposite is offering to
   * undo the thing that was just asked for.
   */
  atFirm?: { id: string; name: string } | null;
}) {
  const [rows, setRows] = useState<Row[]>([]);
  const [primary, setPrimary] = useState(0);
  const [company, setCompany] = useState(true);
  const box = useRef<HTMLDivElement>(null);

  /*
   * An individual provider is the person. There is no firm to have people at,
   * so the whole block goes rather than asking a question with no answer.
   *
   * Read off the form's own radios rather than lifted into a parent: Provider
   * Type is the first thing 5.0a asks and it belongs where it is asked. The
   * fields below unmount with the block, so nothing they hold is submitted.
   */
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

  function change(key: number, field: keyof Omit<Row, "key">, value: string) {
    setRows((was) =>
      was.map((row) => (row.key === key ? { ...row, [field]: value } : row)),
    );
  }

  function remove(index: number) {
    setRows((was) => was.filter((_, at) => at !== index));
    // The primary was below the one removed, or was the one removed.
    setPrimary((at) => (at === index ? 0 : at > index ? at - 1 : at));
  }

  /*
   * An individual is asked which firm they are at instead.
   *
   * A provider row can hold a contact and a company at once — it always could
   * — so a person filed as a provider can also be filed as being at one. The
   * type used to be read off whichever column was filled, which is why nobody
   * could fill both; `kind` says it outright now.
   */
  if (!company) {
    return (
      <div ref={box}>
        <Field label="Works at" htmlFor="firm_id" hint={atFirm ? undefined : "(optional)"}>
          <select
            id="firm_id"
            name="firm_id"
            defaultValue={atFirm?.id ?? ""}
            className={`${CONTROL} text-[13.5px]`}
          >
            {atFirm ? null : <option value="">Independent, not at a firm</option>}
            {(atFirm ? [atFirm, ...firms.filter((f) => f.id !== atFirm.id)] : firms).map(
              (firm) => (
                <option key={firm.id} value={firm.id}>
                  {firm.name}
                </option>
              ),
            )}
          </select>
        </Field>
      </div>
    );
  }

  return (
    <div ref={box}>
      <Field label="People at this company">
      {rows.length === 0 ? (
        <p className="mb-2 text-[12.5px]" style={{ color: "var(--text-tertiary)" }}>
          Nobody yet. Add the people you deal with here and they become contacts
          in this workspace.
        </p>
      ) : null}

      <div className="flex flex-col gap-2.5">
        {rows.map((row, index) => (
          <div
            key={row.key}
            className="rounded-[8px] border p-2.5"
            style={{ borderColor: "var(--border)", background: "var(--surface-subtle)" }}
          >
            <div className="mb-2 flex gap-2">
              <input
                name="person_name"
                autoComplete="off"
                value={row.name}
                onChange={(event) => change(row.key, "name", event.target.value)}
                placeholder="Name"
                className={`${CONTROL} flex-1`}
              />
              <input
                name="person_role"
                autoComplete="off"
                value={row.role}
                onChange={(event) => change(row.key, "role", event.target.value)}
                placeholder="Role"
                className={`${CONTROL} flex-1`}
              />
            </div>

            <div className="flex gap-2">
              <input
                name="person_email"
                autoComplete="off"
                type="email"
                value={row.email}
                onChange={(event) => change(row.key, "email", event.target.value)}
                placeholder="Email"
                className={`${CONTROL} flex-1`}
              />
              <input
                name="person_phone"
                autoComplete="off"
                value={row.phone}
                onChange={(event) => change(row.key, "phone", event.target.value)}
                placeholder="Phone"
                className={`${CONTROL} flex-1`}
              />
            </div>

            <div className="mt-2 flex items-center justify-between">
              <label
                className="flex cursor-pointer items-center gap-1.5 text-[12.5px]"
                style={{ color: "var(--text-secondary)" }}
              >
                <input
                  type="radio"
                  name="person_primary"
                  value={index}
                  checked={primary === index}
                  onChange={() => setPrimary(index)}
                />
                Point of contact
              </label>

              <button
                type="button"
                onClick={() => remove(index)}
                className="shrink-0 px-0.5 text-[14px] font-bold"
                title={`Remove ${row.name || "this person"}`}
                aria-label={`Remove ${row.name || "this person"}`}
                style={{ color: "var(--danger-text)" }}
              >
                ✕
              </button>
            </div>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={() => setRows((was) => [...was, blank()])}
        className="mt-2 text-[12.5px] font-medium"
        style={{ color: "var(--accent)" }}
      >
        + Add a person
      </button>
      </Field>
    </div>
  );
}
