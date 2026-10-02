"use client";

import { useState } from "react";

/**
 * The countries this is sold into, with the code somebody would dial.
 *
 * A list, not a library. A full set is 250 rows and a search box on a screen
 * that is trying to fit on one page, and the ones missing from here are a
 * `+` and the digits away from working, because the number is stored as it
 * is written rather than parsed.
 *
 * Flags are the emoji, which every system this runs on already has.
 */
const COUNTRIES = [
  { code: "PK", flag: "🇵🇰", dial: "+92", name: "Pakistan" },
  { code: "GB", flag: "🇬🇧", dial: "+44", name: "United Kingdom" },
  { code: "US", flag: "🇺🇸", dial: "+1", name: "United States" },
  { code: "AE", flag: "🇦🇪", dial: "+971", name: "United Arab Emirates" },
  { code: "SA", flag: "🇸🇦", dial: "+966", name: "Saudi Arabia" },
  { code: "QA", flag: "🇶🇦", dial: "+974", name: "Qatar" },
  { code: "CA", flag: "🇨🇦", dial: "+1", name: "Canada" },
  { code: "AU", flag: "🇦🇺", dial: "+61", name: "Australia" },
  { code: "IN", flag: "🇮🇳", dial: "+91", name: "India" },
  { code: "SG", flag: "🇸🇬", dial: "+65", name: "Singapore" },
  { code: "CH", flag: "🇨🇭", dial: "+41", name: "Switzerland" },
  { code: "DE", flag: "🇩🇪", dial: "+49", name: "Germany" },
  { code: "FR", flag: "🇫🇷", dial: "+33", name: "France" },
  { code: "IT", flag: "🇮🇹", dial: "+39", name: "Italy" },
  { code: "ES", flag: "🇪🇸", dial: "+34", name: "Spain" },
  { code: "NL", flag: "🇳🇱", dial: "+31", name: "Netherlands" },
  { code: "IE", flag: "🇮🇪", dial: "+353", name: "Ireland" },
  { code: "TR", flag: "🇹🇷", dial: "+90", name: "Türkiye" },
  { code: "ZA", flag: "🇿🇦", dial: "+27", name: "South Africa" },
  { code: "HK", flag: "🇭🇰", dial: "+852", name: "Hong Kong" },
];

/**
 * A number with the country it belongs to.
 *
 * It was one box with "+1 (555) 000-0000" ghosted in it, so everybody outside
 * North America had to know to delete the shape of an American number and
 * type their own code. The country is chosen and the code goes in front of
 * whatever is typed; what is stored is the whole number, as it would be
 * dialled.
 */
export function PhoneField({
  id,
  name,
  defaultValue,
  className,
}: {
  id: string;
  name: string;
  defaultValue?: string | null;
  /** The shared onboarding control class, so it sits with the other fields. */
  className: string;
}) {
  /* A number already stored keeps whatever it was saved as: it is somebody's
     own writing and this box is not the place to reformat it. */
  const held = (defaultValue ?? "").trim();
  const found = held.startsWith("+")
    ? [...COUNTRIES]
        .sort((a, b) => b.dial.length - a.dial.length)
        .find((one) => held.startsWith(one.dial))
    : undefined;

  const [dial, setDial] = useState(found?.dial ?? COUNTRIES[0].dial);
  const [rest, setRest] = useState(found ? held.slice(found.dial.length).trim() : held);
  /* Said after they have finished, not while they are halfway through it:
     "03" is not a wrong number, it is an unfinished one. */
  const [touched, setTouched] = useState(false);

  const typed = rest.trim();
  const digits = typed.replace(/[^0-9]/g, "");
  const wrong = typed.length > 0 && (/[^0-9()\-.\s]/.test(typed) || digits.length < 6 || digits.length > 15);
  const why = /[^0-9()\-.\s]/.test(typed)
    ? "A number holds digits, spaces and ( ) - . only."
    : digits.length < 6
      ? "That looks short for a phone number."
      : "That looks long for a phone number.";

  /*
   * One field, not two boxes.
   *
   * The country and the number were two controls side by side, which read as
   * two questions and left the row out of line with every other row on the
   * card. They are one box now: the country sits inside it, ruled off, the
   * way a phone field looks everywhere else.
   *
   * The shared class carries the padding and `w-full`; the padding moves to
   * the halves inside so the rule between them runs the full height.
   */
  const shell = className.replace(/\bpx-3\b/, "").replace(/\bpy-\[9px\]/, "").trim();

  return (
    <>
    <div
      className={`${shell} pa-onboarding-control flex items-stretch p-0`}
      style={touched && wrong ? { borderColor: "var(--danger-fg)" } : undefined}
    >
      <label className="sr-only" htmlFor={`${id}-country`}>
        Country code
      </label>
      <select
        id={`${id}-country`}
        value={dial}
        onChange={(event) => setDial(event.target.value)}
        /* No chevron on it: the flag and the code are the control, and a
           second arrow inside a field that already has one beside it in the
           next column read as two menus on one row. It still opens on a
           press, because it is still a select. */
        className="shrink-0 cursor-pointer appearance-none rounded-l-control border-none bg-transparent py-[9px] pl-2.5 pr-2 text-[14px] outline-none"
        style={{ color: "var(--ink)" }}
      >
        {COUNTRIES.map((country) => (
          <option key={country.code} value={country.dial}>
            {country.flag} {country.dial}
          </option>
        ))}
      </select>

      <span aria-hidden className="my-2 w-px shrink-0" style={{ background: "var(--border)" }} />

      <input
        id={id}
        type="tel"
        inputMode="tel"
        value={rest}
        onChange={(event) => setRest(event.target.value)}
        onBlur={() => setTouched(true)}
        aria-invalid={touched && wrong ? true : undefined}
        aria-describedby={touched && wrong ? `${id}-wrong` : undefined}
        /* The browser stops the form on this; the line below says why in
           words, because "Match the requested format" explains nothing. */
        pattern="[0-9()\-.\s]{6,20}"
        title="Six to twenty characters: digits, spaces, and ( ) - ."
        placeholder="300 1234567"
        autoComplete="tel-national"
        className="min-w-0 flex-1 rounded-r-control border-none bg-transparent px-3 py-[9px] text-[14.5px] outline-none placeholder:text-[rgba(55,53,47,0.35)]"
        style={{ color: "var(--ink)" }}
      />

      {/* What is actually sent: the code and the number as one. */}
      <input type="hidden" name={name} value={typed ? `${dial} ${typed}` : ""} />
    </div>

    {touched && wrong ? (
      <span
        id={`${id}-wrong`}
        role="alert"
        className="text-[11.5px]"
        style={{ color: "var(--danger-fg)" }}
      >
        {why}
      </span>
    ) : null}
    </>
  );
}
