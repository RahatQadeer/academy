"use client";

import { useEffect, useRef, useState } from "react";
import { Submit } from "@/base/components/Submit";

/**
 * Create Task, dark until the form can actually be submitted.
 *
 * Every field but Next Action is required, and a blue button over an empty
 * form is a button that exists to be pressed and refused: the browser stops
 * on the first empty field with a bubble somebody has to read, having already
 * decided the thing was ready.
 *
 * Validity is the browser's own answer — `checkValidity` over the form this
 * sits in — so the rule is the fields themselves rather than a second list
 * kept in step with them by hand.
 */
export function SubmitWhenReady({ children }: { children: React.ReactNode }) {
  const box = useRef<HTMLSpanElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const form = box.current?.closest("form");
    if (!form) return;

    const look = () => setReady(form.checkValidity());
    look();

    form.addEventListener("input", look);
    form.addEventListener("change", look);

    return () => {
      form.removeEventListener("input", look);
      form.removeEventListener("change", look);
    };
  }, []);

  return (
    <span ref={box}>
      <Submit
        unsized
        variant="primary"
        disabled={!ready}
        className="px-[18px] py-[9px] text-[13.5px]"
        style={
          ready
            ? undefined
            : {
                background: "var(--surface-active)",
                color: "var(--text-disabled)",
                cursor: "not-allowed",
              }
        }
      >
        {children}
      </Submit>
    </span>
  );
}
