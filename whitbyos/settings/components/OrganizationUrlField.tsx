"use client";

import { useEffect, useId, useRef, useState } from "react";

import { CopyUrl } from "@/whitbyos/settings/components/CopyUrl";
import { LABEL } from "@/whitbyos/settings/components/Fields";
import {
  slugifyWorkspaceUrl,
  workspaceUrlError,
} from "@/whitbyos/lib/workspace-url";

/**
 * Organization URL, with live validation.
 *
 * Onboarding and Settings both ask for the same slug. Invalid values show a
 * clear error before submit; a valid slug is accepted as typed (or slugified
 * from a pasted whitby.app address).
 */
export function OrganizationUrlField({
  defaultSlug = "",
  name = "urlSlug",
  showCopy = false,
  size = "settings",
  suggestedFrom,
}: {
  defaultSlug?: string;
  name?: string;
  showCopy?: boolean;
  size?: "settings" | "onboarding";
  /** When the organization name changes and the URL has not been edited by hand. */
  suggestedFrom?: string;
}) {
  const errorId = useId();
  const input = useRef<HTMLInputElement>(null);
  const [touched, setTouched] = useState(false);
  const [slug, setSlug] = useState(defaultSlug);
  const edited = useRef(Boolean(defaultSlug));

  useEffect(() => {
    if (edited.current) return;
    if (!suggestedFrom) return;
    setSlug(slugifyWorkspaceUrl(suggestedFrom));
  }, [suggestedFrom]);

  const live = slugifyWorkspaceUrl(slug);
  const error = workspaceUrlError(slug);
  const showError = Boolean(error) && (touched || slug.length > 0);

  useEffect(() => {
    input.current?.setCustomValidity(error ?? "");
  }, [error]);

  const onboarding = size === "onboarding";

  return (
    <div>
      <label
        htmlFor="urlSlug"
        className={onboarding ? "mb-1.5 block text-[12.5px] font-medium" : LABEL}
        style={{ color: onboarding ? "var(--text-tertiary)" : "var(--text-secondary)" }}
      >
        Organization URL
      </label>
      <div className={showCopy ? "flex gap-2" : ""}>
        <div
          className={`flex min-w-0 flex-1 items-center overflow-hidden rounded-control border ${
            showError ? "border-[var(--danger-border)]" : "border-line-strong"
          }`}
        >
          <span
            className={`shrink-0 border-r border-line-strong ${
              onboarding ? "px-3 py-[9px] text-[14.5px]" : "px-2.5 py-[9px] text-[13.5px]"
            }`}
            style={{
              background: "var(--surface-soft)",
              color: "var(--text-tertiary)",
            }}
          >
            whitby.app/
          </span>
          <input
            ref={input}
            id="urlSlug"
            name={name}
            required
            value={slug}
            onChange={(event) => {
              edited.current = true;
              setSlug(event.target.value);
            }}
            onBlur={() => setTouched(true)}
            autoComplete="off"
            spellCheck={false}
            aria-invalid={showError}
            aria-describedby={showError ? errorId : undefined}
            placeholder="your-organization"
            className={`min-w-0 flex-1 border-none bg-surface text-ink placeholder:text-[rgba(55,53,47,0.35)] ${
              onboarding
                ? "px-3 py-[9px] text-[14.5px]"
                : "px-2.5 py-[9px] text-[13.5px]"
            }`}
          />
        </div>
        {showCopy ? <CopyUrl url={`https://whitby.app/${live || defaultSlug}`} /> : null}
      </div>
      {showError ? (
        <p
          id={errorId}
          className="mt-1.5 text-[12.5px] leading-[1.45]"
          style={{ color: "var(--danger-text)" }}
          role="alert"
        >
          {error}
        </p>
      ) : live ? (
        <p className="mt-1.5 text-[12px]" style={{ color: "var(--text-tertiary)" }}>
          {showCopy
            ? "Unique across every organization. Changing it does not update links already sent."
            : `Your organization will live at whitby.app/${live}`}
        </p>
      ) : (
        <p className="mt-1.5 text-[12px]" style={{ color: "var(--text-tertiary)" }}>
          Letters, numbers and hyphens.
        </p>
      )}
    </div>
  );
}
