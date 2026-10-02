"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

/** The three button treatments used across the onboarding action bar. */

const BASE =
  "inline-flex items-center justify-center rounded-control text-[14.5px] font-medium no-underline transition-all";

/**
 * Continue, and whether there is anything to continue to.
 *
 * It was always pressable, so on a step with a required answer the way to
 * find out that one was missing was to press it and read the browser's own
 * bubble. The button watches the form it sits in instead: while a required
 * field is empty or a value is refused by its own rule, it is plainly off,
 * and it comes on the moment the form would be accepted.
 *
 * `checkValidity` rather than a list of fields, so a step that adds one gets
 * this for nothing and no rule is written twice.
 */
export function PrimaryAction({
  children,
  type = "submit",
}: {
  children: React.ReactNode;
  type?: "submit" | "button";
}) {
  const button = useRef<HTMLButtonElement>(null);
  const [ready, setReady] = useState(true);

  useEffect(() => {
    const form = button.current?.form;
    if (!form) return;

    const look = () => setReady(form.checkValidity());
    look();

    /* `input` covers typing, `change` covers selects, files and checkboxes,
       and the hidden inputs a step writes for itself fire neither — so the
       form is looked at again whenever anything inside it is replaced. */
    form.addEventListener("input", look);
    form.addEventListener("change", look);

    const watch = new MutationObserver(look);
    watch.observe(form, { childList: true, subtree: true, attributes: true });

    return () => {
      form.removeEventListener("input", look);
      form.removeEventListener("change", look);
      watch.disconnect();
    };
  }, []);

  return (
    <button
      ref={button}
      type={type}
      disabled={!ready}
      aria-disabled={!ready}
      title={ready ? undefined : "Fill in what is marked required first"}
      className={`${BASE} px-6 py-[11px] text-white hover:!text-white disabled:cursor-not-allowed`}
      style={{
        background: ready ? "var(--accent)" : "var(--chat-idle, #d2e0f1)",
        boxShadow: ready ? "0 8px 18px -12px rgba(31,72,125,.9)" : undefined,
      }}
    >
      {children}
    </button>
  );
}

export function BackAction({ href }: { href: string }) {
  return (
    <Link
      href={href}
      className={`${BASE} border border-line-strong px-5 py-[10px] font-semibold shadow-[0_1px_0_rgba(255,255,255,.8)] hover:bg-[var(--accent-tint)]`}
      style={{ color: "var(--ink)", background: "var(--surface)" }}
    >
      Back
    </Link>
  );
}

export function SkipAction({
  href,
  onClick,
  /** 4.2 writes "Skip for now"; the others just "Skip". */
  label = "Skip",
}: {
  href?: string;
  onClick?: () => void;
  label?: string;
}) {
  const className = `${BASE} px-4 py-[11px]`;
  const style = { color: "var(--text-tertiary)" };

  if (href) {
    return (
      <Link href={href} className={className} style={style}>
        {label}
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} className={className} style={style}>
      {label}
    </button>
  );
}
