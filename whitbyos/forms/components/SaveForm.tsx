"use client";

import Link from "next/link";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { SubmitPlain } from "@/base/components/Submit";

const DirtyContext = createContext<{ dirty: boolean; markDirty: () => void }>({
  dirty: false,
  markDirty: () => {},
});

/**
 * Whether anything on the builder has been changed since it loaded.
 *
 * Save Form was blue and pressable from the moment the page opened, which says
 * there is something to save when there is not — and once a screen says that
 * about nothing, it stops being read when it says it about something. It is
 * quiet until the form is actually dirty.
 *
 * Two sources, because a form is changed in two ways. Typing and choosing raise
 * `input` and `change` events that bubble to this wrapper, which covers the
 * title, the field editors and the settings selects without any of them knowing
 * about this. Adding, removing and reordering a field are state changes with no
 * event of their own, so `FieldList` says so itself.
 */
export function FormDirtyProvider({ children }: { children: React.ReactNode }) {
  const [dirty, setDirty] = useState(false);
  const markDirty = useCallback(() => setDirty(true), []);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const onChange = () => setDirty(true);
    node.addEventListener("input", onChange);
    node.addEventListener("change", onChange);
    return () => {
      node.removeEventListener("input", onChange);
      node.removeEventListener("change", onChange);
    };
  }, []);

  return (
    <DirtyContext.Provider value={{ dirty, markDirty }}>
      <div ref={ref} className="contents">
        {children}
      </div>
    </DirtyContext.Provider>
  );
}

export function useMarkDirty() {
  return useContext(DirtyContext).markDirty;
}

/**
 * Preview, Save and Send, and the reason Send is not blue.
 *
 * A grey button with its reason in a `title` is a grey button with no reason:
 * the one person who finds it is the one who already knew to hover. The three
 * live together here so the sentence can sit under them and be read.
 *
 * Send is the inverse of Save, and quiet for the same reason — what goes to a
 * client is the *saved* form, so sending with unsaved edits on screen would
 * send the version nobody is looking at.
 */
export function BuilderActions({
  sendHref,
  settingsHref,
  clientVisible,
  hasFields,
  allowSend = true,
}: {
  sendHref: string;
  /** Where visibility is changed, since that is the usual thing in the way. */
  settingsHref: string;
  /** Only a Client Visible form is one a client can be given. */
  clientVisible: boolean;
  hasFields: boolean;
  /** Hide Send entirely when the firm is not using Client Workspaces. */
  allowSend?: boolean;
}) {
  const { dirty } = useContext(DirtyContext);

  const blocked = !allowSend
    ? null
    : dirty
    ? "Save your changes before sending this."
    : !hasFields
      ? "Add a field before this can be sent."
      : !clientVisible
        ? "Only a Client Visible form can be sent to a client."
        : null;

  const shared =
    "rounded-control px-3.5 py-[7px] text-[13px] font-medium no-underline transition-colors";

  return (
    <div className="flex shrink-0 flex-col items-end gap-1.5">
      <div className="flex gap-2">
        <SubmitPlain
          name="then"
          value="preview"
          className="rounded-control border border-line-strong px-3.5 py-[7px] text-[13px] font-medium"
          style={{ background: "var(--surface)", color: "var(--ink)" }}
        >
          Preview
        </SubmitPlain>

        <SaveFormButton />

        {allowSend ? (
          blocked ? (
          <span
            aria-disabled
            className={`${shared} cursor-not-allowed`}
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border-strong)",
              color: "var(--text-disabled)",
            }}
          >
            Send
          </span>
        ) : (
          /* An anchor, not a submit: this form's action is Save, and a second
             submit inside it would save on the way past. */
          <Link
            href={sendHref}
            className={shared}
            style={{ background: "var(--accent)", color: "#fff" }}
          >
            Send
          </Link>
        )
        ) : null}
      </div>

      {blocked ? (
        <p className="text-[11.5px]" style={{ color: "var(--text-tertiary)", margin: 0 }}>
          {blocked}
          {!dirty && hasFields && !clientVisible ? (
            <>
              {" "}
              <Link
                href={settingsHref}
                className="no-underline"
                style={{ color: "var(--accent)" }}
              >
                Change it
              </Link>
            </>
          ) : null}
        </p>
      ) : null}
    </div>
  );
}

/** Save Form — grey and unpressable until there is something to save. */
export function SaveFormButton({ label = "Save Form" }: { label?: string }) {
  const { dirty } = useContext(DirtyContext);

  return (
    <button
      type="submit"
      disabled={!dirty}
      title={dirty ? undefined : "Nothing to save yet"}
      className="rounded-control px-3.5 py-[7px] text-[13px] font-medium transition-colors disabled:cursor-not-allowed"
      style={
        dirty
          ? { background: "var(--accent)", color: "#fff" }
          : {
              background: "var(--surface)",
              border: "1px solid var(--border-strong)",
              color: "var(--text-disabled)",
            }
      }
    >
      {label}
    </button>
  );
}
