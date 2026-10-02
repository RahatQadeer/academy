"use client";

import { useEffect, useRef } from "react";

/**
 * A search box that narrows as you type.
 *
 * These are plain GET forms — the query goes in the URL, so a search
 * survives a refresh and can be sent to somebody — and a GET form waits for
 * Enter. Which is fine if you know that, and looks broken if you do not:
 * you type three letters, nothing moves, and the list you are looking at is
 * still the whole list.
 *
 * So the form submits itself a moment after the typing stops. Everything
 * stays where it was — the search still runs on the server over every row,
 * not just the ones already drawn, the other filters still apply, and the
 * URL still says what you searched for. Only the Enter goes.
 *
 * A pause rather than a keystroke, because a request per letter is four
 * requests for "visa" and the last one is the only one anybody wanted.
 *
 * Rendered as nothing. It attaches to the form it is inside, which is where
 * the input it listens to already lives — no props to keep in step, and the
 * whole thing degrades to the old behaviour if the script never arrives.
 */
export function LiveSearch({ name = "q", wait = 350 }: { name?: string; wait?: number }) {
  const anchor = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const form = anchor.current?.closest("form");
    if (!form) return;

    const box = form.querySelector<HTMLInputElement>(`input[name="${name}"]`);
    if (!box) return;

    let timer = 0;
    /* What the server already answered for. Without it, arriving back from
       the submit fires a fresh one on the same text, forever. */
    let sent = box.value;

    const go = () => {
      if (box.value === sent) return;
      sent = box.value;
      form.requestSubmit();
    };

    const onInput = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(go, wait);
    };

    /* Enter still works, and must not also fire the timer afterwards. */
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Enter") window.clearTimeout(timer);
    };

    box.addEventListener("input", onInput);
    box.addEventListener("keydown", onKey);

    return () => {
      window.clearTimeout(timer);
      box.removeEventListener("input", onInput);
      box.removeEventListener("keydown", onKey);
    };
  }, [name, wait]);

  return <span ref={anchor} hidden />;
}
