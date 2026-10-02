"use client";

import { useEffect, useRef, useState } from "react";
import { SubmitPlain } from "@/base/components/Submit";

/**
 * The group's picture, shown the moment it is chosen.
 *
 * The file input is hidden behind a button, which is what stops "No file
 * chosen" appearing in a font nobody picked — but it also meant choosing a
 * picture changed nothing on screen until the panel was saved and reloaded,
 * so it read as a control that had not worked.
 *
 * The chosen file is drawn straight from the browser with an object URL. The
 * upload still happens on Save, with the rest of the panel; this is only the
 * looking.
 */
export function GroupPicture({
  name,
  photo,
  initials,
  removeAction,
}: {
  name: string;
  /** What is stored now, if anything. */
  photo: string | null;
  /** Drawn where there is no picture at all, computed on the server. */
  initials: string;
  /** Taking the stored one off, where there is one. A server action. */
  removeAction?: (formData: FormData) => Promise<void>;
}) {
  const [preview, setPreview] = useState<string | null>(null);
  const [chosen, setChosen] = useState<string | null>(null);
  const url = useRef<string | null>(null);

  // An object URL is a handle on a blob; letting it go is how the blob is
  // freed, and a panel opened five times would otherwise hold five.
  useEffect(() => {
    return () => {
      if (url.current) URL.revokeObjectURL(url.current);
    };
  }, []);

  const shown = preview ?? photo;

  return (
    <div className="flex items-center gap-4">
      <span
        className="flex h-[62px] w-[62px] shrink-0 items-center justify-center overflow-hidden rounded-full text-[18px] font-bold"
        style={{ background: "var(--accent-tint)", color: "var(--accent)" }}
        aria-hidden
      >
        {shown ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={shown} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
        ) : (
          initials
        )}
      </span>

      <div className="min-w-0 flex-1">
        <label
          htmlFor="photo"
          className="mb-1.5 block text-[12px] font-medium"
          style={{ color: "var(--text-secondary)" }}
        >
          Group name
        </label>
        <input
          id="subject"
          name="subject"
          required
          defaultValue={name}
          className="w-full rounded-control border border-line-strong bg-surface px-2.5 py-[7px] text-[13px] text-ink"
        />

        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
          <label
            htmlFor="photo"
            className="cursor-pointer rounded-control border px-2.5 py-[5px] text-[12px] font-medium"
            style={{
              borderColor: "var(--chrome-line)",
              background: "var(--surface)",
              color: "var(--ink)",
            }}
          >
            {shown ? "Change picture" : "Add a picture"}
          </label>
          <input
            id="photo"
            type="file"
            name="photo"
            accept="image/*"
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0] ?? null;
              if (url.current) URL.revokeObjectURL(url.current);

              if (!file) {
                url.current = null;
                setPreview(null);
                setChosen(null);
                return;
              }

              const made = URL.createObjectURL(file);
              url.current = made;
              setPreview(made);
              setChosen(file.name);
            }}
          />

          {removeAction && !preview ? (
            <SubmitPlain
              formAction={removeAction}
              className="text-[12px] font-medium"
              style={{ color: "var(--text-secondary)" }}
            >
              Remove picture
            </SubmitPlain>
          ) : null}

          <span className="min-w-0 truncate text-[11.5px]" style={{ color: "var(--text-tertiary)" }}>
            {chosen ? `${chosen}, saved with Save.` : "Up to 5 MB, saved with Save."}
          </span>
        </div>
      </div>
    </div>
  );
}
