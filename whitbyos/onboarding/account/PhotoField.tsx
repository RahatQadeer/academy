"use client";

import { useRef, useState } from "react";

/**
 * A photo, chosen with a button that says what it chooses.
 *
 * The browser's own file control reads "Choose File / No file chosen" in a
 * grey chip nobody can style past a point, on the first screen anybody sees
 * of this product. This is the same input, hidden, with a label acting as the
 * button and the chosen file named beside it — and a round preview once
 * there is something to preview, because a profile photo is a thing you
 * check rather than a filename you read.
 */
export function PhotoField({
  id,
  name,
  className,
  currentUrl = null,
}: {
  id: string;
  name: string;
  /** The shared onboarding control class, so the box matches the fields. */
  className: string;
  /** Photo already saved, so Back still shows it. */
  currentUrl?: string | null;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [chosen, setChosen] = useState<{ name: string; preview: string | null } | null>(null);

  function pick(file: File | null) {
    /* The last preview's object URL is released before a new one is made:
       they live until the tab is closed otherwise. */
    setChosen((was) => {
      if (was?.preview) URL.revokeObjectURL(was.preview);
      if (!file) return null;
      return {
        name: file.name,
        preview: file.type.startsWith("image/") ? URL.createObjectURL(file) : null,
      };
    });
  }

  const shown = chosen?.preview ?? currentUrl;
  const label = chosen?.name ?? (currentUrl ? "Current photo" : "No photo chosen yet");

  return (
    <div className={`${className} flex items-center gap-3`}>
      <input
        ref={input}
        id={id}
        name={name}
        type="file"
        accept="image/png,image/jpeg"
        className="sr-only"
        onChange={(event) => pick(event.target.files?.[0] ?? null)}
      />

      {shown ? (
        // A local object URL or a saved signed URL, which the image optimiser cannot fetch.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={shown}
          alt=""
          className="h-9 w-9 shrink-0 rounded-full object-cover"
          style={{ border: "1px solid var(--border)" }}
          referrerPolicy="no-referrer"
        />
      ) : (
        <span
          aria-hidden
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[15px]"
          style={{ background: "var(--accent-tint)", color: "var(--accent)" }}
        >
          ⚇
        </span>
      )}

      <label
        htmlFor={id}
        className="shrink-0 cursor-pointer rounded-control border px-3 py-[6px] text-[13px] font-semibold transition-colors hover:bg-[var(--accent-tint)]"
        style={{ borderColor: "var(--accent)", color: "var(--accent)" }}
      >
        Choose photo
      </label>

      <span className="min-w-0 flex-1 truncate text-[13px]" style={{ color: "var(--text-quiet)" }}>
        {label}
      </span>

      {chosen ? (
        <button
          type="button"
          onClick={() => {
            if (input.current) input.current.value = "";
            pick(null);
          }}
          className="shrink-0 text-[12.5px] font-medium"
          style={{ color: "var(--text-secondary)" }}
        >
          Remove
        </button>
      ) : null}
    </div>
  );
}
