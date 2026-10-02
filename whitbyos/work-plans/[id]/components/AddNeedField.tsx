"use client";

import { useRef, useState } from "react";
import { SubmitPlain } from "@/base/components/Submit";
import { addClientNeed } from "@/whitbyos/work-plans/actions";

/**
 * Asking for something the plan never thought of.
 *
 * Collapsed until pressed — the panel already carries enough fields, and a
 * permanent second row of boxes for an optional ask made every plan look like
 * it wanted something else. One press opens the form; Enter still adds it.
 *
 * In the same form as everything else, sent to a different action by
 * `formAction`, so it inherits the plan id and the return path rather than
 * repeating them. Its own tick box is not needed: something somebody has just
 * typed out is something they want asked.
 */
export function AddNeedField() {
  const [open, setOpen] = useState(false);
  const add = useRef<HTMLButtonElement>(null);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-[13px] font-medium"
        style={{ color: "var(--accent)" }}
      >
        + Ask for something else
      </button>
    );
  }

  return (
    <div className="flex w-full flex-wrap items-end gap-2.5">
      <label className="flex min-w-0 flex-1 flex-col gap-1">
        <span
          className="text-[11px] font-semibold uppercase tracking-[0.06em]"
          style={{ color: "var(--text-tertiary)" }}
        >
          Ask for something else
        </span>
        <input
          name="label"
          autoFocus
          placeholder="Six passport photographs"
          maxLength={160}
          onKeyDown={(event) => {
            /* Mid-composition Enter is choosing a character, not finishing. */
            if (event.key !== "Enter" || event.nativeEvent.isComposing) return;
            event.preventDefault();
            if (!event.currentTarget.value.trim()) return;
            add.current?.click();
          }}
          className="w-full rounded-control border px-2.5 py-1.5 text-[13px]"
          style={{ borderColor: "var(--border-strong)", color: "var(--ink)" }}
        />
      </label>

      {/*
       * And what it is for.
       *
       * Everything the drafter finds now carries a reason, and a hand-added
       * one arriving on the client's form with none beside it reads as the
       * firm asking for something nobody could explain. Optional, because a
       * professional who has the client on the phone should not be stopped
       * by a second box — but asked for, because they are the only person who
       * knows the answer here.
       */}
      <label className="flex min-w-0 flex-1 flex-col gap-1">
        <span
          className="text-[11px] font-semibold uppercase tracking-[0.06em]"
          style={{ color: "var(--text-tertiary)" }}
        >
          Why it is needed
        </span>
        <input
          name="why"
          placeholder="The registrar will not book without them"
          maxLength={200}
          onKeyDown={(event) => {
            if (event.key !== "Enter" || event.nativeEvent.isComposing) return;
            event.preventDefault();
            add.current?.click();
          }}
          className="w-full rounded-control border px-2.5 py-1.5 text-[13px]"
          style={{ borderColor: "var(--border-strong)", color: "var(--ink)" }}
        />
      </label>

      <select
        name="kind"
        defaultValue="document"
        aria-label="What kind of thing this is"
        className="rounded-control border px-2.5 py-[7px] text-[13px]"
        style={{ borderColor: "var(--border-strong)", color: "var(--ink)" }}
      >
        <option value="document">A document to upload</option>
        <option value="information">A detail to type</option>
        <option value="approval">A decision to make</option>
        <option value="account">An account or reference</option>
        <option value="contact">Somebody to reach</option>
      </select>

      <div className="flex shrink-0 items-center gap-2">
        <SubmitPlain
          ref={add}
          formAction={addClientNeed}
          className="inline-flex items-center justify-center rounded-control border px-3 py-[7px] text-[12.5px] font-medium"
          style={{ borderColor: "var(--border-strong)", color: "var(--ink)" }}
        >
          Add
        </SubmitPlain>

        <button
          type="button"
          onClick={() => setOpen(false)}
          className="px-1.5 text-[12.5px] font-medium"
          style={{ color: "var(--text-tertiary)" }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
