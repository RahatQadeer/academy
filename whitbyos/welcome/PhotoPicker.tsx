"use client";

import { useRef } from "react";
import { addWelcomePhoto } from "@/whitbyos/welcome/actions";

/**
 * Choose a file and it uploads — the same one press as Settings → Profile,
 * because picking a photo is the whole intent and a separate Save only exists
 * to make someone confirm what they already said.
 */
export function PhotoPicker({ label }: { label: string }) {
  const form = useRef<HTMLFormElement>(null);

  return (
    <form ref={form} action={addWelcomePhoto}>
      <input
        type="file"
        name="photo"
        id="welcome-photo"
        accept="image/*"
        className="hidden"
        onChange={(event) => {
          if (event.target.files?.length) form.current?.requestSubmit();
        }}
      />
      <label
        htmlFor="welcome-photo"
        className="inline-flex cursor-pointer items-center rounded-control border px-3.5 py-[7px] text-[13px] font-semibold transition-colors hover:bg-[var(--accent-tint)] hover:!text-[var(--accent)]"
        style={{ background: "var(--surface)", borderColor: "var(--accent)", color: "var(--accent)" }}
      >
        {label}
      </label>
    </form>
  );
}
