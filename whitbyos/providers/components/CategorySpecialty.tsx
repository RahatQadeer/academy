"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CONTROL, Field } from "@/whitbyos/components/Field";
import { specialtiesFor } from "@/whitbyos/lib/provider-specialties";
import type { CategoryOption } from "@/whitbyos/lib/taxonomy";

/**
 * Category, Location and Specialty, drawn together because the first decides
 * what the third offers.
 *
 * Specialty is a search rather than a select. A category says which shelf a
 * provider is on; a specialty says what they actually do, and no list is ever
 * going to hold all of those — "UK immigration, appeals", "Part 135 charter,
 * transatlantic", "Arabic to English, certified". So typing filters what is
 * known for the chosen category and anything typed is kept whether it matched
 * or not. Choosing from the list is a shortcut, never a gate.
 *
 * Suggestions come from two places: the starter list for the category, and
 * whatever this firm has already written on other providers. The second is
 * usually the better one, because it is their own vocabulary coming back.
 */
export function CategorySpecialty({
  categories,
  used,
  category,
  specialty,
  location,
  specialtyOnly,
}: {
  categories: CategoryOption[];
  /**
   * Somebody inside a firm: the firm's category and service area are already
   * answered, so only what they personally do is asked. The category still
   * decides which specialties are offered — it is just not a question.
   */
  specialtyOnly?: boolean;
  /** Specialties already written on providers in this workspace. */
  used: string[];
  category?: string | null;
  specialty?: string | null;
  location?: string | null;
}) {
  /*
   * No category rather than the wrong one.
   *
   * A provider filed before the taxonomy was wired up has nothing in
   * `category_id`, and defaulting to whatever sorts first would quietly file
   * a lawyer under Admin / Documents the next time anybody saved the form.
   * An empty option says the truth and makes the answer somebody's to give.
   */
  const known = categories.some((option) => option.id === category);
  const [categoryId, setCategoryId] = useState(known ? category! : "");
  const [query, setQuery] = useState(specialty ?? "");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const box = useRef<HTMLDivElement>(null);

  /*
   * Category is typed at as well, because twenty-five is too many to scroll.
   *
   * Unlike Specialty it is a choice, not a sentence: the taxonomy is shared
   * with Companies and Contacts and is what the directory is organised by, so
   * what goes in is one of the twenty-five or nothing. Typing narrows them;
   * it does not invent a twenty-sixth.
   */
  const chosen = categories.find((option) => option.id === categoryId) ?? null;
  const [categoryQuery, setCategoryQuery] = useState(chosen?.name ?? "");
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [categoryAt, setCategoryAt] = useState(0);
  const categoryBox = useRef<HTMLDivElement>(null);

  const categoryTyped = categoryQuery.trim().toLowerCase();
  const categoryMatches =
    categoryTyped && categoryTyped !== chosen?.name.toLowerCase()
      ? categories.filter((option) => option.name.toLowerCase().includes(categoryTyped))
      : categories;

  function pickCategory(option: CategoryOption) {
    setCategoryId(option.id);
    setCategoryQuery(option.name);
    setCategoryOpen(false);
  }

  /** Leaving the box half-typed puts back whatever is actually chosen. */
  function settleCategory() {
    setCategoryOpen(false);
    setCategoryQuery(chosen?.name ?? "");
  }

  useEffect(() => {
    if (!categoryOpen) return;
    function away(event: MouseEvent) {
      if (!categoryBox.current?.contains(event.target as Node)) settleCategory();
    }
    document.addEventListener("mousedown", away);
    return () => document.removeEventListener("mousedown", away);
  });

  useEffect(() => {
    setCategoryAt(0);
  }, [categoryTyped]);

  const slug = categories.find((option) => option.id === categoryId)?.slug ?? null;

  const suggestions = useMemo(() => {
    const starter = specialtiesFor(slug);
    const seen = new Set(starter.map((s) => s.toLowerCase()));
    // The firm's own words after the starter list, and never twice.
    const theirs = used.filter((s) => s && !seen.has(s.toLowerCase()));
    return [...starter, ...theirs];
  }, [slug, used]);

  const typed = query.trim().toLowerCase();
  const matches = useMemo(() => {
    if (!typed) return suggestions.slice(0, 12);
    return suggestions
      .filter((option) => option.toLowerCase().includes(typed))
      .slice(0, 12);
  }, [suggestions, typed]);

  // An exact match is already in the box; offering to add it again is noise.
  const novel =
    typed.length > 0 &&
    !suggestions.some((option) => option.toLowerCase() === typed);

  /*
   * Something to say when there is nothing to offer.
   *
   * With no category chosen there are no suggestions, and Other / Needs Review
   * has none by design — it is the shelf for things that have not been
   * classified. An empty box that opens onto nothing reads as a field that is
   * broken rather than one that is waiting, so it says which it is.
   */
  const hint = !slug
    ? "Choose a category above to see suggestions. You can write your own either way."
    : suggestions.length === 0
      ? "No suggestions under this category yet. Write your own."
      : typed && matches.length === 0 && !novel
        ? "Nothing matches. Keep typing to write your own."
        : null;

  useEffect(() => {
    if (!open) return;
    function away(event: MouseEvent) {
      if (!box.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", away);
    return () => document.removeEventListener("mousedown", away);
  }, [open]);

  useEffect(() => {
    setActive(0);
  }, [typed, categoryId]);

  function choose(value: string) {
    setQuery(value);
    setOpen(false);
  }

  /* Drawn either on its own or under Category, so it is written once. */
  const specialtyField = (
        <Field label="Specialty" htmlFor="specialty">
          <div ref={box} className="relative">
            <input
              id="specialty"
              name="specialty"
              value={query}
              autoComplete="off"
              role="combobox"
              aria-expanded={open}
              aria-controls="specialty-options"
              aria-autocomplete="list"
              onChange={(event) => {
                setQuery(event.target.value);
                setOpen(true);
              }}
              onFocus={() => setOpen(true)}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  setOpen(false);
                  return;
                }
                if (!open) return;
                const last = matches.length - 1;
                if (event.key === "ArrowDown") {
                  event.preventDefault();
                  setActive((at) => (at >= last ? 0 : at + 1));
                } else if (event.key === "ArrowUp") {
                  event.preventDefault();
                  setActive((at) => (at <= 0 ? last : at - 1));
                } else if (event.key === "Enter" && matches[active]) {
                  // Enter takes the highlighted suggestion rather than submitting
                  // the dialog, which would file the provider halfway through a
                  // word. Escape or a click outside leaves what was typed.
                  event.preventDefault();
                  choose(matches[active]!);
                }
              }}
              placeholder="Type to search, or write your own"
              className={CONTROL}
            />

            {open && (matches.length > 0 || novel || hint) ? (
              <div
                id="specialty-options"
                role="listbox"
                aria-label="Specialty suggestions"
                className="absolute left-0 right-0 top-[calc(100%+4px)] z-40 max-h-[220px] overflow-y-auto rounded-[10px] border py-1"
                style={{
                  borderColor: "var(--chrome-line)",
                  background: "var(--surface)",
                  boxShadow: "0 8px 24px rgba(15,15,15,.12)",
                }}
              >
                {matches.map((option, index) => (
                  <button
                    key={option}
                    type="button"
                    role="option"
                    aria-selected={index === active}
                    onMouseEnter={() => setActive(index)}
                    onClick={() => choose(option)}
                    className="block w-full px-3 py-[7px] text-left text-[13px]"
                    style={{
                      background: index === active ? "var(--accent-tint)" : "transparent",
                      color: index === active ? "var(--accent)" : "var(--ink)",
                    }}
                  >
                    {option}
                  </button>
                ))}

                {novel ? (
                  <div
                    className="px-3 py-[7px] text-[12.5px]"
                    style={{
                      color: "var(--text-tertiary)",
                      borderTop: matches.length ? "1px solid var(--border)" : undefined,
                    }}
                  >
                    Keep &ldquo;{query.trim()}&rdquo; as written
                  </div>
                ) : null}

                {hint ? (
                  <div
                    className="px-3 py-[7px] text-[12.5px] leading-[1.45]"
                    style={{
                      color: "var(--text-tertiary)",
                      borderTop:
                        matches.length || novel ? "1px solid var(--border)" : undefined,
                    }}
                  >
                    {hint}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </Field>
  );

  if (specialtyOnly) {
    return (
      <>
        {/* The firm's category travels with them without being asked. */}
        <input type="hidden" name="category" value={categoryId} />
        {specialtyField}
      </>
    );
  }

  return (
    <>
      <div className="flex gap-3">
        <Field label="Category" htmlFor="category" className="flex-1">
          <div ref={categoryBox} className="relative">
            <input type="hidden" name="category" value={categoryId} />
            <input
              id="category"
              value={categoryQuery}
              autoComplete="off"
              role="combobox"
              aria-expanded={categoryOpen}
              aria-controls="category-options"
              aria-autocomplete="list"
              onChange={(event) => {
                setCategoryQuery(event.target.value);
                setCategoryOpen(true);
              }}
              onFocus={() => setCategoryOpen(true)}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  settleCategory();
                  return;
                }
                if (!categoryOpen) return;
                const last = categoryMatches.length - 1;
                if (event.key === "ArrowDown") {
                  event.preventDefault();
                  setCategoryAt((at) => (at >= last ? 0 : at + 1));
                } else if (event.key === "ArrowUp") {
                  event.preventDefault();
                  setCategoryAt((at) => (at <= 0 ? last : at - 1));
                } else if (event.key === "Enter") {
                  event.preventDefault();
                  if (categoryMatches[categoryAt]) pickCategory(categoryMatches[categoryAt]!);
                }
              }}
              placeholder="Type to search, or choose"
              className={CONTROL}
            />

            {categoryOpen ? (
              <div
                id="category-options"
                role="listbox"
                aria-label="Categories"
                className="absolute left-0 right-0 top-[calc(100%+4px)] z-40 max-h-[240px] overflow-y-auto rounded-[10px] border py-1"
                style={{
                  borderColor: "var(--chrome-line)",
                  background: "var(--surface)",
                  boxShadow: "0 8px 24px rgba(15,15,15,.12)",
                }}
              >
                {categoryMatches.length === 0 ? (
                  <div className="px-3 py-[7px] text-[12.5px]" style={{ color: "var(--text-tertiary)" }}>
                    No category matches. These twenty-five are the whole list.
                  </div>
                ) : (
                  categoryMatches.map((option, index) => (
                    <button
                      key={option.id}
                      type="button"
                      role="option"
                      aria-selected={option.id === categoryId}
                      onMouseEnter={() => setCategoryAt(index)}
                      onClick={() => pickCategory(option)}
                      className="block w-full px-3 py-[7px] text-left text-[13px]"
                      style={{
                        background:
                          index === categoryAt ? "var(--accent-tint)" : "transparent",
                        color: index === categoryAt ? "var(--accent)" : "var(--ink)",
                      }}
                    >
                      {option.name}
                    </button>
                  ))
                )}
              </div>
            ) : null}
          </div>
        </Field>

        <Field label="Location" htmlFor="location" className="flex-1">
          <input
            id="location"
            name="location"
            autoComplete="off"
            defaultValue={location ?? ""}
            placeholder="City or service area"
            className={CONTROL}
          />
        </Field>
      </div>

      {specialtyField}
    </>
  );
}
