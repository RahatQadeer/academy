"use client";

import { useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { SubmitPlain } from "@/base/components/Submit";

/**
 * The send button, counting what is actually ticked.
 *
 * It used to read "Ask for the other 18" off the number of un-asked rows the
 * server had drawn, which is what *could* go rather than what will: ticking
 * one and pressing it sent one and the button had said eighteen. Ticking is
 * browser state, so the only place that number is known is here.
 *
 * With none ticked the press is refused on the server anyway, so the button
 * says so and stays disabled rather than spending a round trip on an error.
 */
export function AskSubmit({
  fresh,
  remind,
  note,
}: {
  /** How many rows the panel drew with a box on them. */
  fresh: number;
  /** Nothing left to ask for: the press is a chase, and ticks do not apply. */
  remind: boolean;
  /** The line beside the button when something is ticked. */
  note: string;
}) {
  const anchor = useRef<HTMLSpanElement>(null);
  // Every box is drawn ticked, so this is the count until somebody changes one.
  const [ticked, setTicked] = useState(fresh);

  /*
   * Sending, and then having sent.
   *
   * The action revalidates rather than redirecting now, so nothing navigates
   * and there is no landing page to carry a "sent" message. The rows do
   * change, from For your approval to Waiting, which is the real
   * confirmation, but the press itself needs an answer of its own or it
   * reads as a button that did nothing for four seconds.
   */
  const { pending } = useFormStatus();
  const [sent, setSent] = useState(false);
  const was = useRef(false);

  useEffect(() => {
    if (pending) {
      was.current = true;
      setSent(false);
      return;
    }

    if (!was.current) return;
    was.current = false;
    setSent(true);

    /* Long enough to read, short enough that it is gone before the next
       thing somebody does. The rows carry the state from here on. */
    const timer = setTimeout(() => setSent(false), 6000);
    return () => clearTimeout(timer);
  }, [pending]);

  useEffect(() => {
    const form = anchor.current?.closest("form");
    if (!form) return;

    const count = () => {
      const boxes = form.querySelectorAll<HTMLInputElement>('input[name="ask"]');
      setTicked([...boxes].filter((box) => box.checked).length);
    };

    count();

    // On the form rather than on each box: rows come and go as needs are added
    // and removed, and one listener that survives that is simpler than keeping
    // a list of them in step.
    form.addEventListener("change", count);
    return () => form.removeEventListener("change", count);
  }, []);

  const nothing = !remind && ticked === 0;

  return (
    <>
      <span
        ref={anchor}
        className="text-[12px]"
        style={{ color: "var(--text-tertiary)" }}
      >
        {sent
          ? remind
            ? "Reminder sent."
            : "Sent. The client has it now."
          : remind
            ? note
            : nothing
              ? "Nothing is ticked."
              : note}
      </span>

      <SubmitPlain
        disabled={nothing}
        className="inline-flex items-center justify-center gap-2 rounded-control px-3.5 py-1.5 text-[12.5px] font-medium disabled:opacity-50"
        style={{ background: "var(--accent)", color: "#fff" }}
      >
        {/*
          * Approve, because that is what the press is.
          *
          * Whitby draws up what the work needs and goes no further: this
          * button is the gate between a list it wrote and a message the
          * client receives, and "Ask" read as though the asking were already
          * settled and this only chose the moment.
          */}
        {pending
          ? "Sending"
          : remind
          ? "Send a reminder"
          : nothing
            ? "Nothing to approve"
            : ticked === 1
              ? "Approve it and send"
              : ticked === fresh
                ? `Approve all ${ticked} and send`
                : `Approve these ${ticked} and send`}
      </SubmitPlain>
    </>
  );
}
