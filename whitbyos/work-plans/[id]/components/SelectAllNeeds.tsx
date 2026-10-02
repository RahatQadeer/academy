"use client";

import { useEffect, useRef } from "react";

/**
 * One box that ticks every other box in the form.
 *
 * Twenty rows of a real plan meant twenty presses to leave one thing out, and
 * twenty more to put it back. The list is server rendered and its boxes are
 * plain form controls, so this reaches them through the form they already sit
 * in rather than lifting any of that into React state.
 *
 * Deliberately unnamed: a checkbox with a name posts, and this one is a
 * control over the form rather than an answer in it.
 */
export function SelectAllNeeds({ total }: { total: number }) {
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const master = ref.current;
    const form = master?.form;
    if (!master || !form) return;

    /**
     * Three states, because two cannot tell "all of them" from "some of them",
     * and a box that reads as empty while fifteen rows below it are ticked is
     * a box that will be pressed by somebody expecting the opposite.
     */
    const sync = () => {
      const boxes = form.querySelectorAll<HTMLInputElement>('input[name="ask"]');
      const on = [...boxes].filter((box) => box.checked).length;

      master.checked = boxes.length > 0 && on === boxes.length;
      master.indeterminate = on > 0 && on < boxes.length;
    };

    sync();

    // On the form, not on each box: rows come and go as things are added and
    // removed, and one listener that survives that is simpler than keeping a
    // list of them in step.
    form.addEventListener("change", sync);
    return () => form.removeEventListener("change", sync);
  }, []);

  return (
    <label className="flex cursor-pointer items-center gap-2.5 px-4 py-2">
      <input
        ref={ref}
        type="checkbox"
        defaultChecked
        aria-label={`Approve all ${total}`}
        onChange={(event) => {
          const on = event.currentTarget.checked;
          const form = event.currentTarget.form;
          if (!form) return;

          for (const box of form.querySelectorAll<HTMLInputElement>('input[name="ask"]')) {
            box.checked = on;
          }
        }}
      />
      <span className="text-[12.5px] font-medium" style={{ color: "var(--text-secondary)" }}>
        Select all {total}
      </span>
    </label>
  );
}
